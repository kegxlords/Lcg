import { supabaseAdmin } from '../lib/supabase.js';
import { verifyUser } from '../lib/auth.js';

export default async function handler(req, res) {
  const action = req.query.action;
  try {
    const user = await verifyUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    switch (action) {
      case 'getReferralInfo': return await getReferralInfo(user.id, res);
      case 'getDownlines': return await getDownlines(user.id, res);
      case 'getCommissions': return await getCommissions(user.id, res);
      default: return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function getReferralInfo(userId, res) {
  const { data: profile } = await supabaseAdmin.from('profiles').select('referral_code, total_team_deposit, active_downlines').eq('id', userId).single();
  
  // Count available spins
  const { count: availableSpins } = await supabaseAdmin
    .from('wheel_spins').select('*', { count: 'exact', head: true })
    .eq('user_id', userId).eq('is_claimed', false);

  return res.json({
    referral_code: profile?.referral_code || '',
    team_deposit: profile?.total_team_deposit || 0,
    active_downlines: profile?.active_downlines || 0,
    available_spins: availableSpins || 0
  });
}

async function getDownlines(userId, res) {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('full_name, email, created_at, total_personal_deposit')
    .eq('upline_id', userId)
    .order('created_at', { ascending: false });
  
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ downlines: data || [] });
}

async function getCommissions(userId, res) {
  const { data, error } = await supabaseAdmin
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .eq('type', 'referral_commission')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ commissions: data || [] });
}
