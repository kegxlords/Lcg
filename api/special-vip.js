// lib/special-vip.js
import { randomUUID } from 'node:crypto';
import { supabaseAdmin } from './supabase.js';

/**
 * Check if a user meets requirements for any Special VIP tiers and unlock them.
 * Called automatically after a deposit is approved.
 */
export async function checkAndUnlockTiers(userId) {
  // 1. Get user's current stats
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('total_personal_deposit, total_team_deposit, active_downlines')
    .eq('id', userId)
    .single();

  if (!profile) return;

  const { total_personal_deposit: personalDep, total_team_deposit: teamDep, active_downlines: downlines } = profile;

  // 2. Get all tier requirements
  const { data: tiers } = await supabaseAdmin
    .from('special_referral_tiers')
    .select('*')
    .order('id', { ascending: true });

  if (!tiers) return;

  // 3. Get already unlocked tiers
  const { data: unlocked } = await supabaseAdmin
    .from('user_special_vips')
    .select('tier_id')
    .eq('user_id', userId);
  
  const unlockedIds = new Set(unlocked?.map(u => u.tier_id) || []);

  // 4. Check and unlock
  for (const tier of tiers) {
    if (!unlockedIds.has(tier.id)) {
      if (
        downlines >= tier.req_downlines &&
        teamDep >= tier.req_team_deposit &&
        personalDep >= tier.req_personal_deposit
      ) {
        // Unlock the tier
        await supabaseAdmin.from('user_special_vips').insert({
          user_id: userId,
          tier_id: tier.id,
          unlocked_at: new Date().toISOString(),
          last_daily_payout: null, // Will pay after 24h
          last_monthly_payout: null // Will pay after 30 days
        });
        
        // Optional: Send a system notification here
      }
    }
  }
}

/**
 * Calculate and credit daily/monthly salaries for unlocked tiers.
 * Called by the user endpoint and by the protected scheduled cron runner.
 */
export async function calculateAndCreditPayouts(userId) {
  let totalCredited = 0;

  // 1. Get all unlocked tiers for this user
  const { data: userVips, error } = await supabaseAdmin
    .from('user_special_vips')
    .select('*, special_referral_tiers(daily_salary, monthly_salary, tier_name)')
    .eq('user_id', userId);

  if (error || !userVips?.length) return 0;

  const now = Date.now();
  const msPerDay = 24 * 60 * 60 * 1000;
  const msPerMonth = 30 * msPerDay;

  // 2. Get wallet balance once
  const { data: wallet } = await supabaseAdmin.from('wallets').select('balance').eq('user_id', userId).single();
  let currentBalance = Number(wallet?.balance || 0);

  for (const uv of userVips) {
    const tier = uv.special_referral_tiers;
    let payoutAmount = 0;
    let updates = {};

    // Check Daily Salary (24h cycle)
    if (tier.daily_salary > 0) {
      const lastDaily = uv.last_daily_payout ? new Date(uv.last_daily_payout).getTime() : 0;
      // If never paid, or 24h passed since last payout
      if (!lastDaily || (now - lastDaily) >= msPerDay) {
        payoutAmount += Number(tier.daily_salary);
        updates.last_daily_payout = new Date().toISOString();
      }
    }

    // Check Monthly Salary (30-day rolling cycle)
    if (tier.monthly_salary > 0) {
      const lastMonthly = uv.last_monthly_payout ? new Date(uv.last_monthly_payout).getTime() : 0;
      if (!lastMonthly || (now - lastMonthly) >= msPerMonth) {
        payoutAmount += Number(tier.monthly_salary);
        updates.last_monthly_payout = new Date().toISOString();
      }
    }

    // 3. Credit if due
    if (payoutAmount > 0) {
      currentBalance += payoutAmount;
      totalCredited += payoutAmount;

      // Update timestamps
      await supabaseAdmin.from('user_special_vips').update(updates).eq('id', uv.id);

      // Log transaction
      await supabaseAdmin.from('transactions').insert({
        user_id: userId,
        type: 'special_vip_salary',
        amount: payoutAmount,
        status: 'approved',
        reference: `VIP_SAL_${randomUUID().toUpperCase()}`,
        description: `Salary from ${tier.tier_name}`
      });
    }
  }

  // 4. Update wallet if anything was credited
  if (totalCredited > 0) {
    await supabaseAdmin
      .from('wallets')
      .update({ balance: currentBalance, updated_at: new Date().toISOString() })
      .eq('user_id', userId);
  }

  return totalCredited;
}
