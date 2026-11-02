import { supabaseAdmin } from '../lib/supabase.js';
import { verifyUser, getProfile } from '../lib/auth.js';

export default async function handler(req, res) {
  const action = req.query.action;
  
  try {
    const user = await verifyUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const profile = await getProfile(user.id);
    if (profile?.is_frozen) return res.status(403).json({ error: 'Account frozen. Contact support.' });

    switch (action) {
      case 'getBalance': return await getBalance(user.id, res);
      case 'getHistory': return await getHistory(user.id, res);
      case 'submitDeposit': return await submitDeposit(req, user.id, res);
      case 'requestWithdrawal': return await requestWithdrawal(req, user.id, res);
      default: return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    console.error('[API Wallet Error]:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// --- ACTIONS ---

async function getBalance(userId, res) {
  const { data, error } = await supabaseAdmin
    .from('wallets')
    .select('balance')
    .eq('user_id', userId)
    .single();
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ balance: data?.balance || 0 });
}

async function getHistory(userId, res) {
  const [txns, deps, wds] = await Promise.all([
    supabaseAdmin.from('transactions').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(50),
    supabaseAdmin.from('deposits').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(20),
    supabaseAdmin.from('withdrawals').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(20)
  ]);

  return res.json({
    transactions: txns.data || [],
    deposits: deps.data || [],
    withdrawals: wds.data || []
  });
}

async function submitDeposit(req, userId, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  
  const { amount, sender_name, payment_method, proof_ref } = req.body;
  
  // Get min deposit from settings
  const { data: setting } = await supabaseAdmin.from('site_settings').select('value').eq('key', 'min_deposit').single();
  const minDeposit = Number(setting?.value || 1000);

  if (!amount || Number(amount) < minDeposit) {
    return res.status(400).json({ error: `Minimum deposit is ₦${minDeposit.toLocaleString()}` });
  }

  const { data: deposit, error } = await supabaseAdmin
    .from('deposits')
    .insert({
      user_id: userId,
      amount: Number(amount),
      sender_name: sender_name || 'Unknown',
      payment_method: payment_method || 'bank_transfer',
      proof_ref: proof_ref || null,
      status: 'pending'
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  // Log pending transaction
  await supabaseAdmin.from('transactions').insert({
    user_id: userId,
    type: 'deposit',
    amount: Number(amount),
    status: 'pending',
    reference: `DEP_${deposit.id.slice(0, 8).toUpperCase()}`,
    description: `Deposit request: ₦${Number(amount).toLocaleString()}`
  });

  return res.status(201).json({ success: true, deposit });
}

async function requestWithdrawal(req, userId, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { amount, bank_name, account_number, account_name } = req.body;

  // Get settings
  const { data: settings } = await supabaseAdmin.from('site_settings').select('key, value');
  const settingsMap = {};
  settings?.forEach(s => settingsMap[s.key] = s.value);
  
  const minWithdrawal = Number(settingsMap['min_withdrawal'] || 1000);
  const feePercentage = Number(settingsMap['withdrawal_fee_percentage'] || 0);

  if (!amount || Number(amount) < minWithdrawal) {
    return res.status(400).json({ error: `Minimum withdrawal is ₦${minWithdrawal.toLocaleString()}` });
  }
  if (!bank_name || !account_number || !account_name) {
    return res.status(400).json({ error: 'All bank details are required' });
  }

  // Check balance
  const { data: wallet } = await supabaseAdmin.from('wallets').select('balance').eq('user_id', userId).single();
  const currentBalance = Number(wallet?.balance || 0);
  
  if (currentBalance < Number(amount)) {
    return res.status(400).json({ error: 'Insufficient balance' });
  }

  // Calculate fee and net amount
  const fee = (Number(amount) * feePercentage) / 100;
  const netAmount = Number(amount) - fee;

  // Deduct balance immediately (prevents double spending)
  const { error: walletError } = await supabaseAdmin
    .from('wallets')
    .update({ balance: currentBalance - Number(amount), updated_at: new Date().toISOString() })
    .eq('user_id', userId);
  if (walletError) return res.status(500).json({ error: walletError.message });

  // Create withdrawal record
  const { data: withdrawal, error } = await supabaseAdmin
    .from('withdrawals')
    .insert({
      user_id: userId,
      amount: Number(amount),
      bank_name,
      account_number,
      account_name,
      status: 'pending'
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  // Log pending transaction
  await supabaseAdmin.from('transactions').insert({
    user_id: userId,
    type: 'withdrawal',
    amount: Number(amount),
    status: 'pending',
    reference: `WD_${withdrawal.id.slice(0, 8).toUpperCase()}`,
    description: `Withdrawal request: ₦${Number(amount).toLocaleString()} (Fee: ₦${fee.toLocaleString()})`
  });

  return res.status(201).json({ success: true, withdrawal, fee, net_amount: netAmount });
}
