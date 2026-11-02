// api/investments.js
import { supabaseAdmin } from '../lib/supabase.js';
import { verifyUser, getProfile } from '../lib/auth.js';
import { calculateDailyPayout, calculateLumpSumReturn, isDailyPayoutDue, isLumpSumMature } from '../lib/payouts.js';

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
  let totalCredited = 0;

  // 1. Get all active investments
  const { data: investments, error } = await supabaseAdmin
    .from('investments')
    .select('*, products(name, payout_type, profit, duration_days)')
    .eq('user_id', userId)
    .eq('status', 'active');

  if (error) return res.status(500).json({ error: error.message });

  // 2. Get wallet balance once
  const { data: wallet } = await supabaseAdmin.from('wallets').select('balance').eq('user_id', userId).single();
  let currentBalance = Number(wallet?.balance || 0);

  for (const inv of investments) {
    const product = inv.products;
    let payoutAmount = 0;
    let updateData = {};

    if (product.payout_type === 'daily') {
      if (isDailyPayoutDue(inv.last_payout_date)) {
        payoutAmount = calculateDailyPayout(product.profit, product.duration_days);
        updateData = { last_payout_date: new Date().toISOString() };
      }
    } else if (product.payout_type === 'lump_sum') {
      if (isLumpSumMature(inv.end_date) && !inv.capital_returned) {
        payoutAmount = calculateLumpSumReturn(inv.amount, product.profit);
        updateData = { capital_returned: true, status: 'completed' };
      }
    }

    // 3. Credit if due
    if (payoutAmount > 0) {
      currentBalance += payoutAmount;
      totalCredited += payoutAmount;

      // Update investment record
      await supabaseAdmin.from('investments').update(updateData).eq('id', inv.id);

      // Log transaction
      await supabaseAdmin.from('transactions').insert({
        user_id: userId,
        type: 'investment_return',
        amount: payoutAmount,
        status: 'approved',
        reference: `RET_${inv.id.slice(0, 8).toUpperCase()}`,
        description: `Return from ${product.name}`
      });
    }
  }

  // 4. Update wallet balance if anything was credited
  if (totalCredited > 0) {
    await supabaseAdmin
      .from('wallets')
      .update({ balance: currentBalance, updated_at: new Date().toISOString() })
      .eq('user_id', userId);
  }

  return res.json({ success: true, credited: totalCredited, new_balance: currentBalance });
}
