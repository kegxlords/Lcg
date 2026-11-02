// api/products.js
import { supabaseAdmin } from '../lib/supabase.js';
import { verifyUser, getProfile } from '../lib/auth.js';

export default async function handler(req, res) {
  const action = req.query.action;
  
  try {
    const user = await verifyUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const profile = await getProfile(user.id);
    if (profile?.is_frozen) return res.status(403).json({ error: 'Account frozen.' });

    switch (action) {
      case 'getProducts': return await getProducts(res);
      case 'buyProduct': return await buyProduct(req, user.id, res);
      default: return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    console.error('[API Products Error]:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function getProducts(res) {
  const { data, error } = await supabaseAdmin
    .from('products')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ products: data || [] });
}

async function buyProduct(req, userId, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  
  const { product_id } = req.body;
  if (!product_id) return res.status(400).json({ error: 'Product ID is required' });

  // 1. Get Product Details
  const { data: product, error: prodError } = await supabaseAdmin
    .from('products').select('*').eq('id', product_id).single();
  
  if (prodError || !product) return res.status(404).json({ error: 'Product not found' });
  if (!product.is_active) return res.status(400).json({ error: 'Product is not available' });
  if (product.is_coming_soon) return res.status(400).json({ error: 'This product is coming soon' });

  // 2. LIMITED CAPACITY CHECK (Strict Server-Side)
  if (product.category === 'Limited') {
    if (product.current_sold >= product.max_capacity) {
      return res.status(400).json({ error: 'Product has reached maximum capacity' });
    }
  }

  // 3. Check User Balance
  const { data: wallet, error: walletError } = await supabaseAdmin
    .from('wallets').select('balance').eq('user_id', userId).single();
  
  if (walletError || Number(wallet.balance) < Number(product.price)) {
    return res.status(400).json({ error: 'Insufficient balance' });
  }

  // 4. Calculate Dates & Returns
  const startDate = new Date();
  const endDate = new Date(startDate.getTime() + product.duration_days * 24 * 60 * 60 * 1000);
  
  // 5. Deduct Balance
  const { error: updateWalletError } = await supabaseAdmin
    .from('wallets')
    .update({ balance: Number(wallet.balance) - Number(product.price), updated_at: new Date().toISOString() })
    .eq('user_id', userId);
  
  if (updateWalletError) return res.status(500).json({ error: 'Failed to update balance' });

  // 6. Create Investment Record
  const { data: investment, error: invError } = await supabaseAdmin
    .from('investments')
    .insert({
      user_id: userId,
      product_id: product.id,
      amount: product.price,
      expected_profit: product.profit,
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
      status: 'active',
      last_payout_date: product.payout_type === 'daily' ? null : null,
      capital_returned: false
    })
    .select()
    .single();

  if (invError) return res.status(500).json({ error: invError.message });

  // 7. Increment Capacity (Limited Only)
  if (product.category === 'Limited') {
    await supabaseAdmin
      .from('products')
      .update({ current_sold: product.current_sold + 1 })
      .eq('id', product.id);
  }

  // 8. Log Transaction
  await supabaseAdmin.from('transactions').insert({
    user_id: userId,
    type: 'investment_purchase',
    amount: Number(product.price),
    status: 'approved',
    reference: `INV_${investment.id.slice(0, 8).toUpperCase()}`,
    description: `Invested in ${product.name}`
  });

  // 9. Award 1 Lucky Spin (Self Invest Trigger)
  await supabaseAdmin.from('wheel_spins').insert({
    user_id: userId,
    amount_won: 0, // Determined when they spin
    trigger_type: 'self_invest'
  });

  return res.status(201).json({ success: true, investment });
}
