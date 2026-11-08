import crypto from 'node:crypto';
import { supabaseAdmin } from '../lib/supabase.js';
import { processInvestmentPayoutsForUser } from '../lib/scheduled-payouts.js';

function suppliedSecret(req) {
  const authorization = String(req.headers.authorization || '');
  if (authorization.startsWith('Bearer ')) return authorization.slice(7).trim();
  return String(req.headers['x-cron-secret'] || req.query.secret || '').trim();
}

function secretsMatch(actual, expected) {
  if (!actual || !expected) return false;
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const expected = process.env.CRON_SECRET;
  if (!expected || !secretsMatch(suppliedSecret(req), expected)) {
    return res.status(401).json({ error: 'Unauthorized cron request' });
  }

  try {
    const [{ data: investments, error: investmentError }, { data: vips, error: vipError }] = await Promise.all([
      supabaseAdmin.from('investments').select('user_id').eq('status', 'active'),
      supabaseAdmin.from('user_special_vips').select('user_id')
    ]);
    if (investmentError) throw investmentError;
    if (vipError) throw vipError;

    const userIds = [...new Set([...(investments || []), ...(vips || [])].map((row) => row.user_id).filter(Boolean))];
    const summary = { users_scanned: userIds.length, users_processed: 0, investment_credited: 0, vip_credited: 0, total_credited: 0, errors: [] };

    for (const userId of userIds) {
      try {
        const result = await processInvestmentPayoutsForUser(userId, { includeVip: true });
        summary.users_processed += 1;
        summary.investment_credited += Number(result.investment_credited || 0);
        summary.vip_credited += Number(result.vip_credited || 0);
        summary.total_credited += Number(result.credited || 0);
      } catch (error) {
        console.error('[Cron payout error]', userId, error);
        summary.errors.push({ user_id: userId, error: error.message || 'Payout failed' });
      }
    }

    return res.status(summary.errors.length ? 207 : 200).json({ success: summary.errors.length === 0, ...summary });
  } catch (error) {
    console.error('[Cron error]', error);
    return res.status(500).json({ error: 'Scheduled payout run failed', detail: error.message });
  }
}
