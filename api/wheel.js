import { supabaseAdmin } from '../lib/supabase.js';
import { verifyUser } from '../lib/auth.js';
import { sendAtomicRpcError } from '../lib/atomic-rpc.js';

export default async function handler(req, res) {
  const action = req.query.action;
  try {
    const user = await verifyUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    switch (action) {
      case 'getConfig': return await getConfig(res);
      case 'getHistory': return await getHistory(user.id, res);
      case 'spin': return await spin(req, user.id, res);
      default: return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function getConfig(res) {
  const { data } = await supabaseAdmin.from('wheel_config').select('fixed_prize_amount').eq('id', 1).single();
  return res.json({ fixed_prize: data?.fixed_prize_amount || 600 });
}

async function getHistory(userId, res) {
  const { data } = await supabaseAdmin.from('wheel_spins').select('*').eq('user_id', userId).eq('is_claimed', true).order('created_at', { ascending: false }).limit(20);
  return res.json({ history: data || [] });
}

async function spin(req, userId, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { data, error } = await supabaseAdmin.rpc('claim_wheel_spin_atomic', {
    p_user_id: userId
  });
  if (error) return sendAtomicRpcError(res, error, 'wheel spin');

  return res.status(200).json(data);
}
