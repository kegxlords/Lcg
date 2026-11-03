import { supabaseAdmin } from '../lib/supabase.js';
import { verifyUser } from '../lib/auth.js';

export default async function handler(req, res) {
  const action = req.query.action;
  try {
    const user = await verifyUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    switch (action) {
      case 'getConfig': return await getConfig(res);
      case 'getHistory': return await getHistory(user.id, res);
      case 'spin': return await spin(user.id, res);
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

async function spin(userId, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // 1. Find an unclaimed spin
  const { data: spinRecord, error: findError } = await supabaseAdmin
    .from('wheel_spins')
    .select('id')
    .eq('user_id', userId)
    .eq('is_claimed', false)
    .limit(1)
    .single();

  if (findError || !spinRecord) {
    return res.status(400).json({ error: 'No available spins. Deposit or invest to earn more!' });
  }

  // 2. Get the admin-set fixed prize
  const { data: config } = await supabaseAdmin.from('wheel_config').select('fixed_prize_amount').eq('id', 1).single();
  const prizeAmount = Number(config?.fixed_prize_amount || 600);

  // 3. Update the spin record
  await supabaseAdmin.from('wheel_spins').update({ is_claimed: true, amount_won: prizeAmount }).eq('id', spinRecord.id);

  // 4. Credit Wallet
  const { data: wallet } = await supabaseAdmin.from('wallets').select('balance').eq('user_id', userId).single();
  const newBalance = Number(wallet?.balance || 0) + prizeAmount;
  await supabaseAdmin.from('wallets').update({ balance: newBalance, updated_at: new Date().toISOString() }).eq('user_id', userId);

  // 5. Log Transaction
  await supabaseAdmin.from('transactions').insert({
    user_id: userId,
    type: 'wheel_win',
    amount: prizeAmount,
    status: 'approved',
    reference: `WHEEL_${spinRecord.id.slice(0, 8).toUpperCase()}`,
    description: `Lucky Wheel Win`
  });

  return res.json({ success: true, prize: prizeAmount, new_balance: newBalance });
}
