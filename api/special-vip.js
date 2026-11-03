// api/special-vip.js
import { supabaseAdmin } from '../lib/supabase.js';
import { verifyUser } from '../lib/auth.js';
import { calculateAndCreditPayouts } from '../lib/special-vip.js';

export default async function handler(req, res) {
  const action = req.query.action;
  
  try {
    const user = await verifyUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    switch (action) {
      case 'getMyTiers': return await getMyTiers(user.id, res);
      case 'autoPayout': return await autoPayout(user.id, res);
      default: return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    console.error('[API Special VIP Error]:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function getMyTiers(userId, res) {
  // Get all tier definitions
  const { data: tiers } = await supabaseAdmin
    .from('special_referral_tiers')
    .select('*')
    .order('id', { ascending: true });

  // Get user's unlocked tiers
  const { data: unlocked } = await supabaseAdmin
    .from('user_special_vips')
    .select('tier_id, unlocked_at, last_daily_payout, last_monthly_payout')
    .eq('user_id', userId);

  const unlockedMap = new Map(unlocked?.map(u => [u.tier_id, u]) || []);

  // Get user stats for progress bars
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('total_personal_deposit, total_team_deposit, active_downlines')
    .eq('id', userId)
    .single();

  const result = tiers.map(t => ({
    ...t,
    is_unlocked: unlockedMap.has(t.id),
    unlock_data: unlockedMap.get(t.id) || null,
    user_stats: profile
  }));

  return res.json({ tiers: result });
}

async function autoPayout(userId, res) {
  const credited = await calculateAndCreditPayouts(userId);
  
  // Get new balance
  const { data: wallet } = await supabaseAdmin.from('wallets').select('balance').eq('user_id', userId).single();
  
  return res.json({ 
    success: true, 
    credited, 
    new_balance: wallet?.balance || 0 
  });
}
