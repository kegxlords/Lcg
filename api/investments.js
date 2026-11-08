// api/investments.js
import { supabaseAdmin } from '../lib/supabase.js';
import { verifyUser } from '../lib/auth.js';
import { processInvestmentPayoutsForUser } from '../lib/scheduled-payouts.js';

export default async function handler(req, res) {
  const action = req.query.action;
  try {
    const user = await verifyUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    switch (action) {
      case 'getInvestments': return await getInvestments(user.id, res);
      case 'autoPayout': return await autoPayout(user.id, res);
      default: return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    console.error('[API Investments Error]:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function getInvestments(userId, res) {
  const { data, error } = await supabaseAdmin
    .from('investments')
    .select('*, products(name, category, payout_type)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ investments: data || [] });
}

async function autoPayout(userId, res) {
  const result = await processInvestmentPayoutsForUser(userId);
  return res.json({ success: true, ...result });
}
