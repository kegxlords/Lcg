import { supabaseAdmin } from '../lib/supabase.js';
import { processDepositRewards } from '../lib/rewards.js';
import { centsFromAmount, getAfrStarConfig, verifyAfrStarCallback } from '../lib/afrstar.js';

export const config = { api: { bodyParser: false } };
const MAX_BODY_BYTES = 64 * 1024;

function reply(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.end(body);
}

async function readRawBody(req) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += bytes.length;
    if (total > MAX_BODY_BYTES) throw new Error('Callback body too large.');
    chunks.push(bytes);
  }
  return Buffer.concat(chunks);
}

function parseCallback(rawBody, contentType) {
  const mediaType = String(contentType || '').split(';', 1)[0].trim().toLowerCase();
  const text = rawBody.toString('utf8');
  if (mediaType === 'application/json') {
    const payload = JSON.parse(text);
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('Invalid JSON callback.');
    return payload;
  }
  if (mediaType === 'application/x-www-form-urlencoded') {
    return Object.fromEntries(new URLSearchParams(text));
  }
  throw new Error('Unsupported callback content type.');
}

function amountMatches(order, payload) {
  const expectedCents = centsFromAmount(Number(order.amount).toFixed(2));
  if (expectedCents === null) return false;
  if (order.order_type === 'payout') {
    return centsFromAmount(payload.amount) === expectedCents;
  }

  const actualFields = [payload.amount, payload.amount_paid]
    .filter(value => value !== undefined && value !== null && String(value).trim() !== '');
  return actualFields.length > 0 && actualFields.every(value => centsFromAmount(value) === expectedCents);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return reply(res, 405, 'method not allowed');
  const forwardedBy = String(req.headers?.['x-forwarded-by'] || '').trim().toLowerCase();
  if (forwardedBy !== 'yolotask-afrstar-hub') return reply(res, 403, 'forbidden');

  let rawBody;
  let payload;
  let config;
  try {
    rawBody = await readRawBody(req);
    payload = parseCallback(rawBody, req.headers?.['content-type']);
    config = getAfrStarConfig();
  } catch (error) {
    console.error('[AfrStar callback input error]:', error.message);
    return reply(res, 400, 'invalid callback');
  }

  const orderSn = String(payload.order_sn || '').trim();
  if (!orderSn || !/^\d{1,3}$/.test(String(payload.status ?? ''))) return reply(res, 400, 'invalid callback');

  const { data: order, error: orderError } = await supabaseAdmin
    .from('afrstar_orders')
    .select('*')
    .eq('order_sn', orderSn)
    .maybeSingle();
  if (orderError) {
    console.error('[AfrStar callback order lookup error]:', orderError);
    return reply(res, 500, 'retry');
  }
  if (!order) return reply(res, 404, 'unknown order');
  if (!verifyAfrStarCallback(payload, order, config)) return reply(res, 401, 'invalid signature');

  const platformOsn = String(payload.platform_osn || '');
  if (order.platform_osn && order.platform_osn !== platformOsn) return reply(res, 401, 'platform order mismatch');

  const callbackDetails = {
    content_type: String(req.headers?.['content-type'] || ''),
    merchant_sn: String(payload.merchant_sn || ''),
    order_sn: orderSn,
    platform_osn: platformOsn,
    status: String(payload.status),
    amount: payload.amount === undefined ? null : String(payload.amount),
    amount_paid: payload.amount_paid === undefined ? null : String(payload.amount_paid),
    utr: payload.utr === undefined ? null : String(payload.utr),
    time_paid: payload.time_paid === undefined ? null : String(payload.time_paid),
    time_transfered: payload.time_transfered === undefined ? null : String(payload.time_transfered)
  };
  const { data: result, error: applyError } = await supabaseAdmin.rpc('apply_afrstar_callback', {
    p_order_sn: orderSn,
    p_platform_osn: platformOsn,
    p_status: String(payload.status),
    p_amount_matches: amountMatches(order, payload),
    p_utr: payload.utr === undefined ? null : String(payload.utr),
    p_callback: callbackDetails
  });
  if (applyError) {
    console.error('[AfrStar callback settlement error]:', applyError);
    return reply(res, 500, 'retry');
  }

  // A verified, persisted callback is acknowledged immediately. Referral work runs only
  // after the response is flushed so it cannot delay YOLOTASK's short callback timeout.
  reply(res, 200, 'success');

  if (result?.needs_rewards) {
    const { data: claimed, error: claimError } = await supabaseAdmin.rpc('claim_afrstar_rewards', { p_order_sn: orderSn });
    if (claimError) {
      console.error('[AfrStar reward claim error]:', claimError);
    } else if (claimed === true) {
      try {
        await processDepositRewards(Number(order.amount), order.user_id);
        const { error: completeError } = await supabaseAdmin.rpc('complete_afrstar_rewards', { p_order_sn: orderSn });
        if (completeError) console.error('[AfrStar reward completion error]:', completeError);
      } catch (error) {
        // Keep the reward claim locked so retries cannot duplicate its partial side effects.
        console.error('[AfrStar referral reward error]:', error);
      }
    }
  }
}
