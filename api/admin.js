import { supabaseAdmin } from '../lib/supabase.js';
import { verifyUser, isAdmin } from '../lib/auth.js';
import { processDepositRewards } from '../lib/rewards.js';

import { startAfrStarPayout } from '../lib/afrstar-admin.js';
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
      case 'saveWheelSegment': return await saveWheelSegment(req, res);
      case 'deleteWheelSegment': return await deleteWheelSegment(req, res);
      case 'getSpins': return await getSpins(res);
      
      // Special VIPs
      case 'getSpecialVips': return await getSpecialVips(res);
      case 'updateSpecialVip': return await updateSpecialVip(req, res);
      case 'getUnlockedVIPs': return await getUnlockedVIPs(res);
      
      // Support
      case 'getTickets': return await getTickets(req, res);
      case 'getTicketMessages': return await getTicketMessages(req, res);
      case 'replyToTicket': return await replyToTicket(req, res);
      case 'resolveTicket': return await resolveTicket(req, res);
      
      // Settings
      case 'getSettings': return await getSettings(res);
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
    supabaseAdmin.from('profiles').select('id'),
    supabaseAdmin.from('deposits').select('amount').eq('status', 'approved'),
    supabaseAdmin.from('withdrawals').select('amount').eq('status', 'approved'),
    supabaseAdmin.from('transactions').select('amount').eq('type', 'referral_commission').eq('status', 'approved')
  ]);

  const firstError = [users, deposits, withdrawals, commissions].find((result) => result.error)?.error;
  if (firstError) return res.status(500).json({ error: firstError.message });

  const totalDeposits = deposits.data?.reduce((sum, d) => sum + Number(d.amount), 0) || 0;
  const totalWithdrawals = withdrawals.data?.reduce((sum, w) => sum + Number(w.amount), 0) || 0;
  const totalCommissions = commissions.data?.reduce((sum, c) => sum + Number(c.amount), 0) || 0;

  const [pendingDeposits, pendingWithdrawals, openTickets] = await Promise.all([
    supabaseAdmin.from('deposits').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabaseAdmin.from('withdrawals').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabaseAdmin.from('support_tickets').select('id', { count: 'exact', head: true }).eq('status', 'open')
  ]);
  const pendingError = [pendingDeposits, pendingWithdrawals, openTickets].find((result) => result.error)?.error;
  if (pendingError) return res.status(500).json({ error: pendingError.message });

  return res.json({
    total_users: users.data?.length || 0,
    total_deposits: totalDeposits,
    total_withdrawals: totalWithdrawals,
    total_commissions: totalCommissions,
    pending_deposits: pendingDeposits.count || 0,
    pending_withdrawals: pendingWithdrawals.count || 0,
    open_tickets: openTickets.count || 0,
    updated_at: new Date().toISOString()
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
  const deposits = data || [];
  if (!deposits.length) return res.json({ deposits });
  const { data: gatewayOrders, error: gatewayError } = await supabaseAdmin
    .from('afrstar_orders')
    .select('deposit_id, order_sn, order_status, error_message')
    .in('deposit_id', deposits.map(item => item.id));
  if (gatewayError) return res.status(500).json({ error: gatewayError.message });
  const byDeposit = new Map((gatewayOrders || []).map(order => [order.deposit_id, order]));
  return res.json({ deposits: deposits.map(item => ({ ...item, afrstar: byDeposit.get(item.id) || null })) });
}

async function processDeposit(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { deposit_id, action: status } = req.body;
  if (!deposit_id || !['approved', 'rejected'].includes(status)) return res.status(400).json({ error: 'Invalid deposit action' });

  const { data: deposit, error: depError } = await supabaseAdmin.from('deposits').select('*').eq('id', deposit_id).single();
  if (depError || !deposit) return res.status(404).json({ error: 'Deposit not found' });
  if (deposit.payment_method === 'afrstar') {
    return res.status(409).json({ error: 'AfrStar deposits are settled only by verified gateway callbacks.' });
  }
  if (deposit.status !== 'pending') return res.status(400).json({ error: 'Already processed' });

  const { error: updateError } = await supabaseAdmin.from('deposits').update({ status }).eq('id', deposit_id);
  if (updateError) return res.status(500).json({ error: updateError.message });
  const { error: transactionError } = await supabaseAdmin.from('transactions').update({ status }).in('reference', [
    `DEP_${deposit_id.toUpperCase()}`,
    `DEP_${deposit_id.slice(0, 8).toUpperCase()}`
  ]);
  if (transactionError) return res.status(500).json({ error: transactionError.message });

  if (status === 'approved') {
    // 1. Credit User Wallet
    const { data: wallet, error: walletError } = await supabaseAdmin.from('wallets').select('balance').eq('user_id', deposit.user_id).single();
    if (walletError || !wallet) return res.status(500).json({ error: walletError?.message || 'Wallet not found' });
    const newBalance = Number(wallet?.balance || 0) + Number(deposit.amount);
    const { error: balanceError } = await supabaseAdmin.from('wallets').update({ balance: newBalance, updated_at: new Date().toISOString() }).eq('user_id', deposit.user_id);
    if (balanceError) return res.status(500).json({ error: balanceError.message });

    // 2. Trigger Referral Rewards (Commission + Spin + Stats + Special VIP Check)
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
  const withdrawals = data || [];
  if (!withdrawals.length) return res.json({ withdrawals });
  const { data: gatewayOrders, error: gatewayError } = await supabaseAdmin
    .from('afrstar_orders')
    .select('withdrawal_id, order_sn, order_status, error_message')
    .in('withdrawal_id', withdrawals.map(item => item.id));
  if (gatewayError) return res.status(500).json({ error: gatewayError.message });
  const byWithdrawal = new Map((gatewayOrders || []).map(order => [order.withdrawal_id, order]));
  return res.json({ withdrawals: withdrawals.map(item => ({ ...item, afrstar: byWithdrawal.get(item.id) || null })) });
}

async function processWithdrawal(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { withdrawal_id, action: status } = req.body;
  if (!withdrawal_id || !['approved', 'rejected'].includes(status)) return res.status(400).json({ error: 'Invalid withdrawal action' });

  const { data: withdrawal, error: wdError } = await supabaseAdmin.from('withdrawals').select('*').eq('id', withdrawal_id).single();
  if (wdError || !withdrawal) return res.status(404).json({ error: 'Withdrawal not found' });
  if (withdrawal.status !== 'pending') return res.status(400).json({ error: 'Already processed' });

  const { data: existingGatewayOrder, error: gatewayOrderError } = await supabaseAdmin
    .from('afrstar_orders')
    .select('*')
    .eq('withdrawal_id', withdrawal_id)
    .maybeSingle();
  if (gatewayOrderError) return res.status(500).json({ error: gatewayOrderError.message });
  if (existingGatewayOrder) {
    if (status === 'approved' && isAfrStarEnabled() && ['awaiting_registration', 'registered'].includes(existingGatewayOrder.order_status)) {
      const result = await startAfrStarPayout(withdrawal);
      return res.status(result.statusCode).json(result.body);
    }
    if (existingGatewayOrder.order_status === 'submitted' || existingGatewayOrder.order_status === 'creating') {
      return res.json({ success: true, awaiting_callback: true, order_sn: existingGatewayOrder.order_sn });
    }
    return res.status(409).json({ error: 'This AfrStar payout must be resolved from its gateway callback or reconciliation; it cannot be manually approved or rejected.' });
  }
  if (status === 'approved' && isAfrStarEnabled()) {
    const result = await startAfrStarPayout(withdrawal);
    return res.status(result.statusCode).json(result.body);
  }

  const { error: updateError } = await supabaseAdmin.from('withdrawals').update({ status }).eq('id', withdrawal_id);
  if (updateError) return res.status(500).json({ error: updateError.message });
  const { error: transactionError } = await supabaseAdmin.from('transactions').update({ status }).in('reference', [
    `WD_${withdrawal_id.toUpperCase()}`,
    `WD_${withdrawal_id.slice(0, 8).toUpperCase()}`
  ]);
  if (transactionError) return res.status(500).json({ error: transactionError.message });

  if (status === 'rejected') {
    // Refund balance to user
    const { data: wallet, error: walletError } = await supabaseAdmin.from('wallets').select('balance').eq('user_id', withdrawal.user_id).single();
    if (walletError || !wallet) return res.status(500).json({ error: walletError?.message || 'Wallet not found' });
    const newBalance = Number(wallet?.balance || 0) + Number(withdrawal.amount);
    const { error: balanceError } = await supabaseAdmin.from('wallets').update({ balance: newBalance, updated_at: new Date().toISOString() }).eq('user_id', withdrawal.user_id);
    if (balanceError) return res.status(500).json({ error: balanceError.message });
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
  const users = (data || []).map((user) => ({
    ...user,
    wallet_balance: Number(Array.isArray(user.wallets) ? user.wallets[0]?.balance : user.wallets?.balance) || 0
  }));
  return res.json({ users });
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
  const parsedAmount = Number(amount);
  if (!user_id || !Number.isFinite(parsedAmount) || parsedAmount <= 0 || !['credit', 'debit'].includes(type)) {
    return res.status(400).json({ error: 'User, positive amount, and credit/debit type are required' });
  }

  const { data: wallet, error: walletError } = await supabaseAdmin.from('wallets').select('balance').eq('user_id', user_id).single();
  if (walletError || !wallet) return res.status(404).json({ error: walletError?.message || 'Wallet not found' });
  let newBalance = Number(wallet?.balance || 0);
  
  if (type === 'credit') newBalance += parsedAmount;
  else newBalance -= parsedAmount;
  if (newBalance < 0) return res.status(400).json({ error: 'Debit exceeds wallet balance' });

  const { error: balanceError } = await supabaseAdmin.from('wallets').update({ balance: newBalance, updated_at: new Date().toISOString() }).eq('user_id', user_id);
  if (balanceError) return res.status(500).json({ error: balanceError.message });
  
  const { error: transactionError } = await supabaseAdmin.from('transactions').insert({
    user_id, type: `admin_${type}`, amount: parsedAmount, status: 'approved',
    reference: `ADMIN_${Date.now()}`, description: `Admin ${type}: ${reason}`
  });
  if (transactionError) return res.status(500).json({ error: transactionError.message });

  return res.json({ success: true, new_balance: newBalance });
}

// ==========================================
// PRODUCTS
// ==========================================
async function getProducts(res) {
  const { data, error } = await supabaseAdmin.from('products').select('*').order('sort_order', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ products: data || [] });
}

async function saveProduct(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { id, name, category, price, profit, duration_days, payout_type, max_capacity, is_active, is_coming_soon, sort_order } = req.body || {};
  const parsedPrice = Number(price);
  const parsedProfit = Number(profit);
  const parsedDuration = Number(duration_days);
  const parsedSort = Number(sort_order ?? 0);
  if (!String(name || '').trim() || !['General', 'Welfare', 'Limited'].includes(category) || !['daily', 'lump_sum'].includes(payout_type) || !Number.isFinite(parsedPrice) || parsedPrice < 0 || !Number.isFinite(parsedProfit) || parsedProfit < 0 || !Number.isInteger(parsedDuration) || parsedDuration < 1 || !Number.isFinite(parsedSort)) {
    return res.status(400).json({ error: 'Name, category, payout type, non-negative price/profit, and duration of at least 1 day are required' });
  }
  if (String(category).trim().toLowerCase() === 'limited' && (!Number.isInteger(Number(max_capacity)) || Number(max_capacity) < 1)) {
    return res.status(400).json({ error: 'Limited products require a max capacity of at least 1' });
  }

  const productData = { 
    name: String(name).trim(), category: String(category).trim(),
    price: parsedPrice,
    profit: parsedProfit,
    duration_days: parsedDuration,
    payout_type: String(payout_type).trim(),
    is_active: is_active !== false,
    is_coming_soon: Boolean(is_coming_soon),
    sort_order: parsedSort,
    max_capacity: String(category).trim().toLowerCase() === 'limited' ? Number(max_capacity) : null
  };

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
  const { data, error } = await supabaseAdmin
    .from('wheel_segments')
    .select('id, label, amount, probability, is_active')
    .order('id', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ segments: data || [] });
}

async function saveWheelSegment(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { id, label, amount, probability, is_active = true } = req.body || {};
  const parsedAmount = Number(amount);
  const parsedProbability = Number(probability);
  if (!Number.isFinite(parsedAmount) || parsedAmount < 0 || !Number.isFinite(parsedProbability) || parsedProbability < 0) {
    return res.status(400).json({ error: 'Amount and probability must be valid non-negative numbers' });
  }
  const payload = {
    label: String(label || '').trim() || `₦${parsedAmount.toLocaleString('en-NG')}`,
    amount: parsedAmount,
    probability: parsedProbability,
    is_active: Boolean(is_active),
    updated_at: new Date().toISOString()
  };
  const query = id
    ? supabaseAdmin.from('wheel_segments').update(payload).eq('id', id)
    : supabaseAdmin.from('wheel_segments').insert(payload);
  const { error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ success: true });
}

async function deleteWheelSegment(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { id } = req.body || {};
  if (!id) return res.status(400).json({ error: 'Segment id is required' });
  const { error } = await supabaseAdmin.from('wheel_segments').delete().eq('id', id);
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

async function getUnlockedVIPs(res) {
  const { data, error } = await supabaseAdmin
    .from('user_special_vips')
    .select('*, profiles(email, full_name), special_referral_tiers(tier_name)')
    .order('unlocked_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ unlocked: data || [] });
}

// ==========================================
// SUPPORT
// ==========================================
async function getTickets(req, res) {
  const status = req.query.status || 'open';
  const query = supabaseAdmin.from('support_tickets').select('*, profiles(email, full_name)').order('created_at', { ascending: false });
  if (status !== 'all') query.eq('status', status);
  
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ tickets: data || [] });
}

async function getTicketMessages(req, res) {
  const ticketId = req.query.ticket_id;
  if (!ticketId) return res.status(400).json({ error: 'Ticket ID required' });

  const { data, error } = await supabaseAdmin
    .from('support_messages')
    .select('*')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true });
  
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ messages: data || [] });
}

async function replyToTicket(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { ticket_id, message } = req.body;
  if (!ticket_id || !String(message || '').trim()) return res.status(400).json({ error: 'Ticket and message are required' });

  const { error: messageError } = await supabaseAdmin.from('support_messages').insert({
    ticket_id, sender_type: 'admin', message: String(message).trim()
  });
  if (messageError) return res.status(500).json({ error: messageError.message });

  const { error: ticketError } = await supabaseAdmin.from('support_tickets').update({ status: 'open' }).eq('id', ticket_id);
  if (ticketError) return res.status(500).json({ error: ticketError.message });

  return res.json({ success: true });
}

async function resolveTicket(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { ticket_id } = req.body || {};
  if (!ticket_id) return res.status(400).json({ error: 'Ticket ID required' });
  const { error } = await supabaseAdmin.from('support_tickets').update({ status: 'resolved' }).eq('id', ticket_id);
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ success: true });
}

// ==========================================
// SETTINGS
// ==========================================
async function getSettings(res) {
  const { data, error } = await supabaseAdmin.from('site_settings').select('key, value');
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ settings: data || [] });
}

async function saveSettings(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { settings } = req.body || {}; // Array of { key, value }
  if (!Array.isArray(settings)) return res.status(400).json({ error: 'Settings must be an array' });

  for (const item of settings) {
    if (!item?.key) return res.status(400).json({ error: 'Each setting needs a key' });
    const { error } = await supabaseAdmin.from('site_settings').upsert({ key: item.key, value: String(item.value ?? '') }, { onConflict: 'key' });
    if (error) return res.status(500).json({ error: error.message });
  }

  return res.json({ success: true });
}
