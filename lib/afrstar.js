import { createHmac, createHash, randomUUID, timingSafeEqual } from 'node:crypto';

const HUB_REGISTER_URL = 'https://yolotask.com.ng/hooks/afrstar/register.php';
const AFRSTAR_API_BASE = 'https://ngn.afrstar.com/gateway';

export class AfrStarConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AfrStarConfigurationError';
  }
}

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new AfrStarConfigurationError(`Missing server configuration: ${name}`);
  return value;
}

export function isAfrStarEnabled() {
  return process.env.AFRSTAR_ENABLED === 'true';
}

export function getAfrStarConfig() {
  const callbackUrl = requiredEnv('AFRSTAR_CALLBACK_URL');
  const parsedCallbackUrl = new URL(callbackUrl);
  if (parsedCallbackUrl.protocol !== 'https:' || parsedCallbackUrl.pathname !== '/api/afrstar-callback') {
    throw new AfrStarConfigurationError('AFRSTAR_CALLBACK_URL must be the HTTPS /api/afrstar-callback URL on this site.');
  }

  const returnUrl = process.env.AFRSTAR_RETURN_URL?.trim() || new URL('/app/deposit.html?payment=return', parsedCallbackUrl.origin).toString();
  if (new URL(returnUrl).protocol !== 'https:') {
    throw new AfrStarConfigurationError('AFRSTAR_RETURN_URL must use HTTPS.');
  }

  return {
    merchantSn: requiredEnv('AFRSTAR_MERCHANT_SN'),
    merchantAk: requiredEnv('AFRSTAR_MERCHANT_AK'),
    merchantSk: requiredEnv('AFRSTAR_MERCHANT_SK'),
    hubClient: requiredEnv('YOLOTASK_HUB_CLIENT'),
    hubSecret: requiredEnv('YOLOTASK_HUB_SECRET'),
    callbackUrl,
    returnUrl
  };
}

export function newOrderSn(kind) {
  const prefix = kind === 'payout' ? 'LCG-WDL-' : 'LCG-DEP-';
  return `${prefix}${randomUUID().replaceAll('-', '').toUpperCase()}`;
}

export function amountToFixed(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Amount must be a positive number.');
  return amount.toFixed(2);
}

export function md5Signature(value) {
  return createHash('md5').update(value, 'utf8').digest('hex');
}

export function hubSignature(timestamp, rawBody, secret) {
  return createHmac('sha256', secret).update(`${timestamp}.`, 'utf8').update(rawBody).digest('hex');
}

export async function registerOrderWithYolotask(orderSn, callbackUrl, config = getAfrStarConfig()) {
  const rawBody = Buffer.from(JSON.stringify({ order_sn: orderSn, callback_url: callbackUrl }), 'utf8');
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = hubSignature(timestamp, rawBody, config.hubSecret);
  const response = await fetch(HUB_REGISTER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Hub-Client': config.hubClient,
      'X-Hub-Timestamp': timestamp,
      'X-Hub-Signature': signature
    },
    body: rawBody,
    signal: AbortSignal.timeout(8000)
  });
  const result = await response.json().catch(() => null);
  const acceptedStatus = response.status === 200 || response.status === 201;
  const acceptedBody = result?.ok === true && ['registered', 'updated'].includes(result?.status);
  if (!acceptedStatus || !acceptedBody) {
    const relayError = result?.error || result?.message || result?.status || `HTTP ${response.status}`;
    throw new Error(`YOLOTASK did not register order ${orderSn}: ${relayError}`);
  }
  return result;
}

async function postAfrStar(path, payload) {
  const response = await fetch(`${AFRSTAR_API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(12000)
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result || Number(result.code) !== 0) {
    const message = result?.message || `HTTP ${response.status}`;
    throw new Error(`AfrStar order request failed: ${message}`);
  }
  return result;
}

export async function createCollectionOrder({ orderSn, amount, name, email, phone }, config = getAfrStarConfig()) {
  const fixedAmount = amountToFixed(amount);
  const payload = {
    merchant_sn: config.merchantSn,
    order_sn: orderSn,
    amount: fixedAmount,
    name,
    email,
    phone,
    remark: `LCG wallet deposit ${orderSn}`,
    redirect_url: config.returnUrl,
    sign: md5Signature(`${config.merchantAk}${orderSn}${fixedAmount}${config.merchantSk}`)
  };
  const result = await postAfrStar('/payin/', payload);
  const payUrl = result.data?.pay_url;
  const platformOsn = result.data?.platform_osn;
  if (typeof payUrl !== 'string' || !platformOsn) throw new Error('AfrStar returned an incomplete collection order.');
  let parsedPayUrl;
  try { parsedPayUrl = new URL(payUrl); } catch { throw new Error('AfrStar returned an invalid checkout URL.'); }
  if (parsedPayUrl.protocol !== 'https:') throw new Error('AfrStar returned a non-HTTPS checkout URL.');
  return { platformOsn: String(platformOsn), payUrl, providerResponse: result };
}

export async function createPayoutOrder({ orderSn, amount, name, account, bankCode }, config = getAfrStarConfig()) {
  const fixedAmount = amountToFixed(amount);
  const upiHandle = '';
  const payload = {
    merchant_sn: config.merchantSn,
    order_sn: orderSn,
    amount: fixedAmount,
    type: 'bank',
    name,
    account,
    ifsc: bankCode,
    upi_handle: upiHandle,
    remark: `LCG withdrawal ${orderSn}`,
    sign: md5Signature(`${config.merchantAk}${orderSn}${account}${upiHandle}${fixedAmount}${config.merchantSk}`)
  };
  const result = await postAfrStar('/payout/', payload);
  const platformOsn = result.data?.platform_osn;
  if (!platformOsn) throw new Error('AfrStar returned an incomplete payout order.');
  return { platformOsn: String(platformOsn), providerResponse: result };
}

export function verifyAfrStarCallback(payload, order, config = getAfrStarConfig()) {
  if (!payload || String(payload.merchant_sn || '') !== config.merchantSn) return false;
  const platformOsn = String(payload.platform_osn || '');
  const status = String(payload.status ?? '');
  const provided = String(payload.sign || '').toLowerCase();
  if (!platformOsn || !status || !/^[a-f0-9]{32}$/.test(provided)) return false;

  const originalAmount = amountToFixed(order.amount);
  const expected = order.order_type === 'collection'
    ? md5Signature(`${config.merchantAk}${platformOsn}${status}${originalAmount}${config.merchantSk}`)
    : md5Signature(`${config.merchantAk}${platformOsn}${status}${originalAmount}${config.merchantSk}`);
  const expectedBuffer = Buffer.from(expected, 'hex');
  const providedBuffer = Buffer.from(provided, 'hex');
  return expectedBuffer.length === providedBuffer.length && timingSafeEqual(expectedBuffer, providedBuffer);
}

export function centsFromAmount(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const text = String(value).trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) return null;
  const [whole, fraction = ''] = text.split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}
