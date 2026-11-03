// lib/rewards.js
import { supabaseAdmin } from './supabase.js';

/**
 * Award a spin to a user
 */
export async function awardSpin(userId, triggerType) {
  const { error } = await supabaseAdmin
    .from('wheel_spins')
    .insert({ user_id: userId, amount_won: 0, trigger_type: triggerType, is_claimed: false });
  
  if (error) console.error('Failed to award spin:', error);
}

/**
 * Process referral rewards when a downline deposits
 * 1. Credit 10% commission to upline
 * 2. Award 1 spin to upline
 * 3. Update team stats
 */
export async function processDepositRewards(depositAmount, downlineUserId) {
  // 1. Get downline's upline
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('upline_id')
    .eq('id', downlineUserId)
    .single();

  if (!profile?.upline_id) return; // No upline, no rewards

  const uplineId = profile.upline_id;

  // 2. Get commission percentage from settings
  const { data: setting } = await supabaseAdmin
    .from('site_settings')
    .select('value')
    .eq('key', 'referral_commission_percentage')
    .single();
  
  const commPct = Number(setting?.value || 10);
  const commission = (Number(depositAmount) * commPct) / 100;

  // 3. Credit Upline Wallet
  const { data: uplineWallet } = await supabaseAdmin
    .from('wallets').select('balance').eq('user_id', uplineId).single();
  
  const newBalance = Number(uplineWallet?.balance || 0) + commission;
  await supabaseAdmin.from('wallets')
    .update({ balance: newBalance, updated_at: new Date().toISOString() })
    .eq('user_id', uplineId);

  // 4. Log Commission Transaction
  await supabaseAdmin.from('transactions').insert({
    user_id: uplineId,
    type: 'referral_commission',
    amount: commission,
    status: 'approved',
    reference: `COMM_${Date.now()}`,
    description: `${commPct}% commission from downline deposit`
  });

  // 5. Award 1 Spin to Upline
  await awardSpin(uplineId, 'referral_deposit');

  // 6. Update Team Stats (Total Team Deposit & Active Downlines)
  // Note: In a high-scale app, use a Postgres RPC function for atomic updates.
  await supabaseAdmin.rpc('update_team_stats', { 
    p_upline_id: uplineId, 
    p_deposit_amount: depositAmount 
  }).catch(async () => {
    // Fallback if RPC doesn't exist yet
    const { data: uplineProfile } = await supabaseAdmin.from('profiles').select('total_team_deposit, active_downlines').eq('id', uplineId).single();
    await supabaseAdmin.from('profiles').update({
      total_team_deposit: (uplineProfile?.total_team_deposit || 0) + Number(depositAmount),
      active_downlines: (uplineProfile?.active_downlines || 0) + 1
    }).eq('id', uplineId);
  });
}
