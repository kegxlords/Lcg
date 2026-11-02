import { supabaseAdmin } from '../lib/supabase.js';
import { verifyUser, isAdmin } from '../lib/auth.js';

export default async function handler(req, res) {
  const action = req.query.action;
  
  try {
    const user = await verifyUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    if (!(await isAdmin(user.id))) return res.status(403).json({ error: 'Admin access required' });

    switch (action) {
      case 'processDeposit': return await processDeposit(req, res);
      case 'processWithdrawal': return await processWithdrawal(req, res);
      default: return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    console.error('[API Admin Error]:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function processDeposit(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { deposit_id, action: status } = req.body; // action: 'approved' or 'rejected'

  const { data: deposit, error: depError } = await supabaseAdmin
    .from('deposits').select('*').eq('id', deposit_id).single();
  if (depError || !deposit) return res.status(404).json({ error: 'Deposit not found' });
  if (deposit.status !== 'pending') return res.status(400).json({ error: 'Already processed' });

  // Update deposit status
  await supabaseAdmin.from('deposits').update({ status }).eq('id', deposit_id);

  // Update transaction status
  await supabaseAdmin.from('transactions')
    .update({ status })
    .eq('reference', `DEP_${deposit_id.slice(0, 8).toUpperCase()}`);

  if (status === 'approved') {
    // 1. Credit user wallet
    const { data: wallet } = await supabaseAdmin.from('wallets').select('balance').eq('user_id', deposit.user_id).single();
    const newBalance = Number(wallet?.balance || 0) + Number(deposit.amount);
    await supabaseAdmin.from('wallets').update({ balance: newBalance, updated_at: new Date().toISOString() }).eq('user_id', deposit.user_id);

    // Update transaction to approved
    await supabaseAdmin.from('transactions').update({ status: 'approved' }).eq('reference', `DEP_${deposit_id.slice(0, 8).toUpperCase()}`);

    // 2. Pay Upline Commission & Award Spin
    const { data: profile } = await supabaseAdmin.from('profiles').select('upline_id').eq('id', deposit.user_id).single();
    if (profile?.upline_id) {
      const { data: settings } = await supabaseAdmin.from('site_settings').select('key, value');
      const commPct = Number(settings?.find(s => s.key === 'referral_commission_percentage')?.value || 10);
      const commission = (Number(deposit.amount) * commPct) / 100;

      // Credit upline
      const { data: uplineWallet } = await supabaseAdmin.from('wallets').select('balance').eq('user_id', profile.upline_id).single();
      const uplineNewBalance = Number(uplineWallet?.balance || 0) + commission;
      await supabaseAdmin.from('wallets').update({ balance: uplineNewBalance, updated_at: new Date().toISOString() }).eq('user_id', profile.upline_id);

      // Log commission transaction
      await supabaseAdmin.from('transactions').insert({
        user_id: profile.upline_id,
        type: 'referral_commission',
        amount: commission,
        status: 'approved',
        reference: `COMM_${deposit_id.slice(0, 8).toUpperCase()}`,
        description: `10% commission from downline deposit`
      });

      // Award 1 spin to upline
      await supabaseAdmin.from('wheel_spins').insert({
        user_id: profile.upline_id,
        amount_won: 0, // Will be determined when they spin
        trigger_type: 'referral_deposit'
      });

      // Update upline team stats
      await supabaseAdmin.rpc('increment_team_stats', { 
        p_upline_id: profile.upline_id, 
        p_amount: deposit.amount 
      }).catch(() => {
        // Fallback if RPC doesn't exist yet
        supabaseAdmin.from('profiles').update({ 
          total_team_deposit: supabaseAdmin.sql`total_team_deposit + ${deposit.amount}`,
          active_downlines: supabaseAdmin.sql`active_downlines + 1`
        }).eq('id', profile.upline_id);
      });
    }
  }

  return res.json({ success: true });
}

async function processWithdrawal(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { withdrawal_id, action: status } = req.body;

  const { data: withdrawal, error: wdError } = await supabaseAdmin
    .from('withdrawals').select('*').eq('id', withdrawal_id).single();
  if (wdError || !withdrawal) return res.status(404).json({ error: 'Withdrawal not found' });
  if (withdrawal.status !== 'pending') return res.status(400).json({ error: 'Already processed' });

  await supabaseAdmin.from('withdrawals').update({ status }).eq('id', withdrawal_id);
  await supabaseAdmin.from('transactions').update({ status }).eq('reference', `WD_${withdrawal_id.slice(0, 8).toUpperCase()}`);

  if (status === 'rejected') {
    // Refund balance
    const { data: wallet } = await supabaseAdmin.from('wallets').select('balance').eq('user_id', withdrawal.user_id).single();
    const newBalance = Number(wallet?.balance || 0) + Number(withdrawal.amount);
    await supabaseAdmin.from('wallets').update({ balance: newBalance, updated_at: new Date().toISOString() }).eq('user_id', withdrawal.user_id);
  }

  return res.json({ success: true });
}
