import { supabaseAdmin } from '../lib/supabase.js';
import { verifyUser, getProfile } from '../lib/auth.js';
import { sendAtomicRpcError } from '../lib/atomic-rpc.js';
import {
  AfrStarConfigurationError,
  createCollectionOrder,
  getAfrStarConfig,
  isAfrStarEnabled,
  newOrderSn,
  registerOrderWithYolotask
} from '../lib/afrstar.js';

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
      case 'getPaymentConfig': return getPaymentConfig(res);
      case 'submitDeposit': return await submitDeposit(req, user, profile, res);
      case 'requestWithdrawal': return await requestWithdrawal(req, user.id, res);
      default: return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    console.error('[API Wallet Error]:', error);
    if (error instanceof AfrStarConfigurationError) {
      return res.status(503).json({ error: 'AfrStar payments are not configured on this server.' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
}

function getPaymentConfig(res) {
  let afrstarEnabled = false;
  if (isAfrStarEnabled()) {
    try {
      getAfrStarConfig();
      afrstarEnabled = true;
    } catch (error) {
      if (!(error instanceof AfrStarConfigurationError)) throw error;
    }
  }
  return res.json({ afrstar_enabled: afrstarEnabled });
}

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

async function submitDeposit(req, user, profile, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { amount, sender_name, payment_method = 'bank_transfer', proof_ref, phone } = req.body || {};
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0 || !Number.isInteger(numericAmount * 100)) {
    return res.status(400).json({ error: 'Enter an amount with no more than two decimal places.' });
  }

  const { data: setting } = await supabaseAdmin.from('site_settings').select('value').eq('key', 'min_deposit').single();
  const minDeposit = Number(setting?.value || 1000);
  if (numericAmount < minDeposit) {
    return res.status(400).json({ error: `Minimum deposit is ₦${minDeposit.toLocaleString()}` });
  }

  if (payment_method === 'afrstar') {
    if (!isAfrStarEnabled()) return res.status(503).json({ error: 'AfrStar checkout is currently unavailable.' });
    const config = getAfrStarConfig();
    const senderName = typeof sender_name === 'string' ? sender_name.trim() : '';
    const customerPhone = typeof phone === 'string' ? phone.trim() : '';
    const customerEmail = String(user.email || profile?.email || '').trim();
    if (!senderName || senderName.length > 120 || !customerPhone || customerPhone.length > 40 || !customerEmail) {
      return res.status(400).json({ error: 'Enter your full name and phone number; your account must have an email address for AfrStar checkout.' });
    }

    const orderSn = newOrderSn('collection');
    const { data: created, error: createError } = await supabaseAdmin.rpc('create_afrstar_collection', {
      p_user_id: user.id,
      p_amount: numericAmount.toFixed(2),
      p_sender_name: senderName,
      p_order_sn: orderSn
    });
    if (createError) {
      console.error('[AfrStar collection create error]:', createError);
      return res.status(500).json({ error: 'Could not start the AfrStar deposit. Please try again.' });
    }

    const order = created?.afrstar_order;
    try {
      await registerOrderWithYolotask(orderSn, config.callbackUrl, config);
    } catch (error) {
      console.error('[YOLOTASK registration error]:', error);
      return res.status(502).json({ error: 'Could not register this payment callback. No AfrStar order was created; please try again.' });
    }

    const { data: registered, error: registerUpdateError } = await supabaseAdmin
      .from('afrstar_orders')
      .update({ order_status: 'registered', updated_at: new Date().toISOString() })
      .eq('id', order.id)
      .eq('order_status', 'awaiting_registration')
      .select('id')
      .maybeSingle();
    if (registerUpdateError || !registered) {
      console.error('[AfrStar order registration state error]:', registerUpdateError);
      return res.status(500).json({ error: 'Callback registration was accepted, but the payment could not be safely started. Contact support with this reference.' });
    }

    const { data: creating, error: claimError } = await supabaseAdmin
      .from('afrstar_orders')
      .update({ order_status: 'creating', updated_at: new Date().toISOString() })
      .eq('id', order.id)
      .eq('order_status', 'registered')
      .select('id')
      .maybeSingle();
    if (claimError || !creating) {
      console.error('[AfrStar collection claim error]:', claimError);
      return res.status(409).json({ error: 'This payment order is already being processed. Check your wallet before trying again.' });
    }

    let gatewayOrder;
    try {
      gatewayOrder = await createCollectionOrder({
        orderSn,
        amount: numericAmount,
        name: senderName,
        email: customerEmail,
        phone: customerPhone
      }, config);
    } catch (error) {
      console.error('[AfrStar collection order error]:', error);
      await supabaseAdmin.from('afrstar_orders')
        .update({ order_status: 'review', error_message: 'AfrStar order result requires reconciliation.', updated_at: new Date().toISOString() })
        .eq('id', order.id)
        .eq('order_status', 'creating');
      return res.status(502).json({ error: 'AfrStar could not confirm the checkout order. Do not retry payment; contact support with the reference.' });
    }

    const { error: saveOrderError } = await supabaseAdmin.from('afrstar_orders')
      .update({
        order_status: 'submitted',
        platform_osn: gatewayOrder.platformOsn,
        pay_url: gatewayOrder.payUrl,
        error_message: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', order.id)
      .eq('order_status', 'creating');
    if (saveOrderError) {
      console.error('[AfrStar collection save error]:', saveOrderError);
      return res.status(500).json({ error: 'AfrStar created the order, but its status could not be saved. Do not pay again; contact support.' });
    }

    return res.status(201).json({
      success: true,
      payment_method: 'afrstar',
      deposit: created.deposit,
      order_sn: orderSn,
      pay_url: gatewayOrder.payUrl
    });
  }

  if (payment_method !== 'bank_transfer') {
    return res.status(400).json({ error: 'Unsupported deposit payment method.' });
  }
  if (typeof sender_name !== 'string' || !sender_name.trim() || typeof proof_ref !== 'string' || !proof_ref.trim()) {
    return res.status(400).json({ error: 'Enter a sender name and bank-transfer reference.' });
  }

  const { data: deposit, error } = await supabaseAdmin
    .from('deposits')
    .insert({
      user_id: user.id,
      amount: numericAmount,
      sender_name: sender_name.trim(),
      payment_method: 'bank_transfer',
      proof_ref: proof_ref.trim(),
      status: 'pending'
    })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });

  const { error: transactionError } = await supabaseAdmin.from('transactions').insert({
    user_id: user.id,
    type: 'deposit',
    amount: numericAmount,
    status: 'pending',
    reference: `DEP_${deposit.id.toUpperCase()}`,
    description: `Deposit request: ₦${numericAmount.toLocaleString()}`
  });
  if (transactionError) {
    await supabaseAdmin.from('deposits').delete().eq('id', deposit.id).eq('status', 'pending');
    return res.status(500).json({ error: 'Could not record the deposit transaction.' });
  }

  return res.status(201).json({ success: true, deposit });
}

async function requestWithdrawal(req, userId, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { amount, bank_name, account_number, account_name, bank_code } = req.body || {};
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0 || !Number.isInteger(numericAmount * 100)) {
    return res.status(400).json({ error: 'Enter an amount with no more than two decimal places.' });
  }

  const afrStarEnabled = isAfrStarEnabled();
  if (afrStarEnabled) getAfrStarConfig();
  const normalizedBankCode = typeof bank_code === 'string' ? bank_code.trim() : '';
  if (afrStarEnabled && !/^800\d{5}$/.test(normalizedBankCode)) {
    return res.status(400).json({ error: 'Enter the eight-digit AfrStar Nigerian bank code for this account.' });
  }

  const { data: settings, error: settingsError } = await supabaseAdmin.from('site_settings').select('key, value');
  if (settingsError) return res.status(500).json({ error: 'Unable to load withdrawal settings.' });
  const settingsMap = {};
  settings?.forEach(s => settingsMap[s.key] = s.value);
  const minWithdrawal = Number(settingsMap['min_withdrawal'] || 1000);
  const feePercentage = Number(settingsMap['withdrawal_fee_percentage'] || 0);

  if (!Number.isFinite(minWithdrawal) || minWithdrawal < 0 ||
      !Number.isFinite(feePercentage) || feePercentage < 0 || feePercentage > 100) {
    return res.status(500).json({ error: 'Withdrawal settings are invalid' });
  }
  if (numericAmount < minWithdrawal) {
    return res.status(400).json({ error: `Minimum withdrawal is ₦${minWithdrawal.toLocaleString()}` });
  }
  if (typeof bank_name !== 'string' || !bank_name.trim() ||
      typeof account_number !== 'string' || !account_number.trim() ||
      typeof account_name !== 'string' || !account_name.trim()) {
    return res.status(400).json({ error: 'All bank details are required' });
  }

  const { data, error } = await supabaseAdmin.rpc('request_withdrawal_atomic', {
    p_user_id: userId,
    p_amount: numericAmount.toFixed(2),
    p_bank_name: bank_name.trim(),
    p_account_number: account_number.trim(),
    p_account_name: account_name.trim(),
    p_min_withdrawal: minWithdrawal,
    p_fee_percentage: feePercentage,
    p_bank_code: normalizedBankCode || null
  });
  if (error) return sendAtomicRpcError(res, error, 'withdrawal');
  return res.status(201).json(data);
}
