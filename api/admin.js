import { supabaseAdmin } from '../lib/supabase.js';
import { verifyUser, isAdmin } from '../lib/auth.js';
import { processDepositRewards } from '../lib/rewards.js';

export default async function handler(req, res) {
  const action = req.query.action;

  try {
    // 1. Security Check
    const user = await verifyUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    
    const adminCheck = await isAdmin(user.id);
    if (!adminCheck) return res.status(403).json({ error: 'Admin access required' });

    // 2. Route Actions
    switch (action) {
      // Dashboard
      case 'getDashboardStats': return await getDashboardStats(res);
      
      // Deposits & Withdrawals
      case 'getDeposits': return await getDeposits(req, res);
      case 'processDeposit': return await processDeposit(req, res);
      case 'getWithdrawals': return await getWithdrawals(req, res);
      case 'processWithdrawal': return await processWithdrawal(req, res);
      
      // Users
      case 'getUsers': return await getUsers(req, res);
      case 'updateUser': return await updateUser(req, res);
      case 'adjustBalance': return await adjustBalance(req, res);
      
      // Products
      case 'getProducts': return await getProducts(res);
      case 'saveProduct': return await saveProduct(req, res);
      case 'deleteProduct': return await deleteProduct(req, res);
      
      // Wheel
      case 'getWheelConfig': return await getWheelConfig(res);
      case 'saveWheelConfig': return await saveWheelConfig(req, res);
      case 'getSpins': return await getSpins(res);
      
      // Special VIPs
      case 'getSpecialVips': return await getSpecialVips(res);
      case 'updateSpecialVip': return await updateSpecialVip(req, res);
      
      // Support
      case 'getTickets': return await getTickets(req, res);
      case 'replyToTicket': return await replyToTicket(req, res);
      
      // Settings
      case 'saveSettings': return await saveSettings(req, res);
      
      default: return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    console.error('[API Admin Error]:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ==========================================
// DASHBOARD
// ==========================================
async function getDashboardStats(res) {
  const [users, deposits, withdrawals, commissions] = await Promise.all([
    supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('deposits').select('amount', { count: 'exact', head: true }).eq('status', 'approved'),
    supabaseAdmin.from('withdrawals').select('amount', { count: 'exact', head: true }).eq('status', 'approved'),
    supabaseAdmin.from('transactions').select('amount').eq('type', 'referral_commission').eq('status', 'approved')
  ]);

  const totalDeposits = deposits.data?.reduce((sum, d) => sum + Number(d.amount), 0) || 0;
  const totalWithdrawals = withdrawals.data?.reduce((sum, w) => sum + Number(w.amount), 0) || 0;
  const totalCommissions = commissions.data?.reduce((sum, c) => sum + Number(c.amount), 0) || 0;

  return res.json({
    total_users: users.count || 0,
    total_deposits: totalDeposits,
    total_withdrawals: totalWithdrawals,
    total_commissions: totalCommissions
  });
}

// ==========================================
// DEPOSITS
// ==========================================
async function getDeposits(req, res) {
  const status = req.query.status || 'pending';
  const query = supabaseAdmin.from('deposits').select('*, profiles(full_name, email)').order('created_at', { ascending: false });
  
  if (status !== 'all') query.eq('status', status);
  
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ deposits: data || [] });
}

async function processDeposit(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { deposit_id, action: status } = req.body;

  const { data: deposit, error: depError } = await supabaseAdmin.from('deposits').select('*').eq('id', deposit_id).single();
  if (depError || !deposit) return res.status(404).json({ error: 'Deposit not found' });
  if (deposit.status !== 'pending') return res.status(400).json({ error: 'Already processed' });

  await supabaseAdmin.from('deposits').update({ status }).eq('id', deposit_id);
  await supabaseAdmin.from('transactions').update({ status }).eq('reference', `DEP_${deposit_id.slice(0, 8).toUpperCase()}`);

  if (status === 'approved') {
    // 1. Credit User
    const { data: wallet } = await supabaseAdmin.from('wallets').select('balance').eq('user_id', deposit.user_id).single();
    const newBalance = Number(wallet?.balance || 0) + Number(deposit.amount);
    await supabaseAdmin.from('wallets').update({ balance: newBalance, updated_at: new Date().toISOString() }).eq('user_id', deposit.user_id);

    // 2. Trigger Referral Rewards (Commission + Spin + Stats)
    await processDepositRewards(deposit.amount, deposit.user_id);
  }

  return res.json({ success: true });
}

// ==========================================
// WITHDRAWALS
// ==========================================
async function getWithdrawals(req, res) {
  const status = req.query.status || 'pending';
  const query = supabaseAdmin.from('withdrawals').select('*, profiles(full_name, email)').order('created_at', { ascending: false });
  
  if (status !== 'all') query.eq('status', status);
  
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ withdrawals: data || [] });
}

async function processWithdrawal(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { withdrawal_id, action: status } = req.body;

  const { data: withdrawal, error: wdError } = await supabaseAdmin.from('withdrawals').select('*').eq('id', withdrawal_id).single();
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

// ==========================================
// USERS
// ==========================================
async function getUsers(req, res) {
  const search = req.query.search || '';
  const query = supabaseAdmin.from('profiles').select('*, wallets(balance)').ilike('email', `%${search}%`).limit(50);
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ users: data || [] });
}

async function updateUser(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { user_id, is_admin, is_frozen } = req.body;
  
  const updates = {};
  if (is_admin !== undefined) updates.is_admin = is_admin;
  if (is_frozen !== undefined) updates.is_frozen = is_frozen;

  const { error } = await supabaseAdmin.from('profiles').update(updates).eq('id', user_id);
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ success: true });
}

async function adjustBalance(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { user_id, amount, type, reason } = req.body;

  const { data: wallet } = await supabaseAdmin.from('wallets').select('balance').eq('user_id', user_id).single();
  let newBalance = Number(wallet?.balance || 0);
  
  if (type === 'credit') newBalance += Number(amount);
  else if (type === 'debit') newBalance -= Number(amount);

  await supabaseAdmin.from('wallets').update({ balance: newBalance, updated_at: new Date().toISOString() }).eq('user_id', user_id);
  
  await supabaseAdmin.from('transactions').insert({
    user_id, type: `admin_${type}`, amount: Number(amount), status: 'approved',
    reference: `ADMIN_${Date.now()}`, description: `Admin ${type}: ${reason}`
  });

  return res.json({ success: true, new_balance: newBalance });
}

// ==========================================
// PRODUCTS
// ==========================================
async function getProducts(res) {
  const { data } = await supabaseAdmin.from('products').select('*').order('sort_order', { ascending: true });
  return res.json({ products: data || [] });
}

async function saveProduct(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { id, name, category, price, profit, duration_days, payout_type, max_capacity, is_active, is_coming_soon, sort_order } = req.body;

  const productData = { name, category, price: Number(price), profit: Number(profit), duration_days: Number(duration_days), payout_type, is_active, is_coming_soon, sort_order: Number(sort_order) };
  if (category === 'Limited') productData.max_capacity = Number(max_capacity);

  let error;
  if (id) {
    ({ error } = await supabaseAdmin.from('products').update(productData).eq('id', id));
  } else {
    ({ error } = await supabaseAdmin.from('products').insert(productData));
  }

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ success: true });
}

async function deleteProduct(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { id } = req.body;
  const { error } = await supabaseAdmin.from('products').delete().eq('id', id);
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ success: true });
}

// ==========================================
// WHEEL
// ==========================================
async function getWheelConfig(res) {
  const { data } = await supabaseAdmin.from('wheel_config').select('*').eq('id', 1).single();
  return res.json({ config: data });
}

async function saveWheelConfig(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { fixed_prize_amount } = req.body;
  const { error } = await supabaseAdmin.from('wheel_config').update({ fixed_prize_amount: Number(fixed_prize_amount) }).eq('id', 1);
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ success: true });
}

async function getSpins(res) {
  const { data } = await supabaseAdmin.from('wheel_spins').select('*, profiles(email)').order('created_at', { ascending: false }).limit(100);
  return res.json({ spins: data || [] });
}

// ==========================================
// SPECIAL VIPS
// ==========================================
async function getSpecialVips(res) {
  const { data } = await supabaseAdmin.from('special_referral_tiers').select('*').order('id', { ascending: true });
  return res.json({ tiers: data || [] });
}

async function updateSpecialVip(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { id, daily_salary, monthly_salary, req_downlines, req_team_deposit, req_personal_deposit } = req.body;
  
  const { error } = await supabaseAdmin.from('special_referral_tiers').update({
    daily_salary: Number(daily_salary),
    monthly_salary: Number(monthly_salary),
    req_downlines: Number(req_downlines),
    req_team_deposit: Number(req_team_deposit),
    req_personal_deposit: Number(req_personal_deposit)
  }).eq('id', id);

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ success: true });
}

// ==========================================
// SUPPORT
// ==========================================
async function getTickets(req, res) {
  const status = req.query.status || 'open';
  const query = supabaseAdmin.from('support_tickets').select('*, profiles(email)').order('created_at', { ascending: false });
  if (status !== 'all') query.eq('status', status);
  
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ tickets: data || [] });
}

async function replyToTicket(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { ticket_id, message } = req.body;

  await supabaseAdmin.from('support_messages').insert({
    ticket_id, sender_type: 'admin', message
  });

  await supabaseAdmin.from('support_tickets').update({ status: 'open' }).eq('id', ticket_id);

  return res.json({ success: true });
}

// ==========================================
// SETTINGS
// ==========================================
async function saveSettings(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { settings } = req.body; // Array of { key, value }

  for (const item of settings) {
    await supabaseAdmin.from('site_settings').upsert({ key: item.key, value: String(item.value) }, { onConflict: 'key' });
  }

  return res.json({ success: true });
}
