import { supabaseAdmin } from './supabase.js';
import { calculateDailyPayout, calculateLumpSumReturn, isDailyPayoutDue, isLumpSumMature } from './payouts.js';
import { calculateAndCreditPayouts } from './special-vip.js';

function isDailyInvestmentComplete(investment, now = new Date()) {
  if (!investment.end_date) return false;
  return now >= new Date(investment.end_date);
}

export async function processInvestmentPayoutsForUser(userId, { includeVip = false } = {}) {
  const { data: investments, error } = await supabaseAdmin
    .from('investments')
    .select('*, products(name, payout_type, profit, duration_days)')
    .eq('user_id', userId)
    .eq('status', 'active');
  if (error) throw error;

  const { data: wallet, error: walletError } = await supabaseAdmin
    .from('wallets').select('balance').eq('user_id', userId).single();
  if (walletError || !wallet) throw walletError || new Error('Wallet not found');

  let currentBalance = Number(wallet.balance || 0);
  let totalCredited = 0;
  let processed = 0;
  const now = new Date();

  for (const investment of investments || []) {
    const product = investment.products;
    if (!product) continue;
    let payoutAmount = 0;
    let updateData = {};
    let description = '';

    if (product.payout_type === 'daily') {
      const atMaximumDay = isDailyInvestmentComplete(investment, now);
      if (isDailyPayoutDue(investment.last_payout_date)) {
        payoutAmount = calculateDailyPayout(product.profit, product.duration_days);
        description = `Daily income from ${product.name}`;
        if (atMaximumDay) {
          payoutAmount += Number(investment.amount || 0);
          updateData = { last_payout_date: now.toISOString(), capital_returned: true, status: 'completed' };
          description = `Final daily income and capital return from ${product.name}`;
        } else {
          updateData = { last_payout_date: now.toISOString() };
        }
      } else if (atMaximumDay) {
        // A missed final cycle still closes the investment and returns capital.
        payoutAmount = Number(investment.amount || 0);
        updateData = { capital_returned: true, status: 'completed' };
        description = `Capital return from ${product.name}`;
      }
    } else if (product.payout_type === 'lump_sum' && isLumpSumMature(investment.end_date) && !investment.capital_returned) {
      payoutAmount = calculateLumpSumReturn(investment.amount, product.profit);
      updateData = { capital_returned: true, status: 'completed' };
      description = `Matured return from ${product.name}`;
    }

    if (payoutAmount <= 0) continue;
    let updateQuery = supabaseAdmin.from('investments').update(updateData).eq('id', investment.id).eq('status', 'active');
    if (investment.last_payout_date) updateQuery = updateQuery.eq('last_payout_date', investment.last_payout_date);
    else updateQuery = updateQuery.is('last_payout_date', null);
    const { data: updatedInvestment, error: updateError } = await updateQuery.select('id').maybeSingle();
    if (updateError) throw updateError;
    if (!updatedInvestment) continue;
    const { error: transactionError } = await supabaseAdmin.from('transactions').insert({
      user_id: userId,
      type: 'investment_return',
      amount: payoutAmount,
      status: 'approved',
      reference: `RET_${investment.id.slice(0, 8).toUpperCase()}_${Date.now()}`,
      description
    });
    if (transactionError) throw transactionError;
    currentBalance += payoutAmount;
    totalCredited += payoutAmount;
    processed += 1;
  }

  if (totalCredited > 0) {
    const { error: balanceError } = await supabaseAdmin.from('wallets')
      .update({ balance: currentBalance, updated_at: now.toISOString() })
      .eq('user_id', userId);
    if (balanceError) throw balanceError;
  }

  const vipCredited = includeVip ? await calculateAndCreditPayouts(userId) : 0;
  return { credited: totalCredited + Number(vipCredited || 0), investment_credited: totalCredited, vip_credited: Number(vipCredited || 0), processed, new_balance: currentBalance };
}
