import { randomUUID } from 'node:crypto';
import { supabaseAdmin } from '../lib/supabase.js';
import { verifyUser } from '../lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const user = await verifyUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const action = req.query?.action;
    if (action !== 'getMyTiers') return res.status(400).json({ error: 'Invalid action' });

    const [{ data: profile, error: profileError }, { data: tiers, error: tiersError }, { data: unlocked, error: unlockedError }] = await Promise.all([
      supabaseAdmin
        .from('profiles')
        .select('total_personal_deposit, total_team_deposit, active_downlines')
        .eq('id', user.id)
        .maybeSingle(),
      supabaseAdmin
        .from('special_referral_tiers')
        .select('*')
        .order('id', { ascending: true }),
      supabaseAdmin
        .from('user_special_vips')
        .select('*')
        .eq('user_id', user.id)
    ]);

    if (profileError || tiersError || unlockedError) {
      console.error('[API Special VIP Data Error]:', profileError || tiersError || unlockedError);
      return res.status(500).json({ error: 'Could not load VIP program data.' });
    }

    const unlockedByTier = new Map((unlocked || []).map((item) => [String(item.tier_id), item]));
    const userStats = {
      total_personal_deposit: Number(profile?.total_personal_deposit || 0),
      total_team_deposit: Number(profile?.total_team_deposit || 0),
      active_downlines: Number(profile?.active_downlines || 0)
    };

    const result = (tiers || []).map((tier) => {
      const membership = unlockedByTier.get(String(tier.id));
      return {
        ...tier,
        is_unlocked: Boolean(membership),
        unlock_data: membership || null,
        user_stats: userStats
      };
    });

    return res.json({ tiers: result, stats: userStats });
  } catch (error) {
    console.error('[API Special VIP Error]:', error);
    return res.status(500).json({ error: 'Could not load VIP program data.' });
  }
}

/**
 * Check if a user meets requirements for any Special VIP tiers and unlock them.
 * Called automatically after a deposit is approved.
 */
export async function checkAndUnlockTiers(userId) {
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('total_personal_deposit, total_team_deposit, active_downlines')
    .eq('id', userId)
    .single();

  if (!profile) return;

  const { total_personal_deposit: personalDep, total_team_deposit: teamDep, active_downlines: downlines } = profile;
  const { data: tiers } = await supabaseAdmin
    .from('special_referral_tiers')
    .select('*')
    .order('id', { ascending: true });

  if (!tiers) return;

  const { data: unlocked } = await supabaseAdmin
    .from('user_special_vips')
    .select('tier_id')
    .eq('user_id', userId);
  const unlockedIds = new Set(unlocked?.map((item) => item.tier_id) || []);

  for (const tier of tiers) {
    if (!unlockedIds.has(tier.id) && downlines >= tier.req_downlines && teamDep >= tier.req_team_deposit && personalDep >= tier.req_personal_deposit) {
      await supabaseAdmin.from('user_special_vips').insert({
        user_id: userId,
        tier_id: tier.id,
        unlocked_at: new Date().toISOString(),
        last_daily_payout: null,
        last_monthly_payout: null
      });
    }
  }
}

/**
 * Calculate and credit daily/monthly salaries for unlocked tiers.
 * Called by the user endpoint and by the protected scheduled cron runner.
 */
export async function calculateAndCreditPayouts(userId) {
  let totalCredited = 0;
  const { data: userVips, error } = await supabaseAdmin
    .from('user_special_vips')
    .select('*, special_referral_tiers(daily_salary, monthly_salary, tier_name)')
    .eq('user_id', userId);

  if (error || !userVips?.length) return 0;

  const now = Date.now();
  const msPerDay = 24 * 60 * 60 * 1000;
  const msPerMonth = 30 * msPerDay;
  const { data: wallet } = await supabaseAdmin.from('wallets').select('balance').eq('user_id', userId).single();
  let currentBalance = Number(wallet?.balance || 0);

  for (const uv of userVips) {
    const tier = uv.special_referral_tiers;
    let payoutAmount = 0;
    const updates = {};

    if (tier.daily_salary > 0) {
      const lastDaily = uv.last_daily_payout ? new Date(uv.last_daily_payout).getTime() : 0;
      if (!lastDaily || (now - lastDaily) >= msPerDay) {
        payoutAmount += Number(tier.daily_salary);
        updates.last_daily_payout = new Date().toISOString();
      }
    }

    if (tier.monthly_salary > 0) {
      const lastMonthly = uv.last_monthly_payout ? new Date(uv.last_monthly_payout).getTime() : 0;
      if (!lastMonthly || (now - lastMonthly) >= msPerMonth) {
        payoutAmount += Number(tier.monthly_salary);
        updates.last_monthly_payout = new Date().toISOString();
      }
    }

    if (payoutAmount > 0) {
      currentBalance += payoutAmount;
      totalCredited += payoutAmount;
      await supabaseAdmin.from('user_special_vips').update(updates).eq('id', uv.id);
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

  if (totalCredited > 0) {
    await supabaseAdmin
      .from('wallets')
      .update({ balance: currentBalance, updated_at: new Date().toISOString() })
      .eq('user_id', userId);
  }

  return totalCredited;
}
