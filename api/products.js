// api/products.js
import { supabaseAdmin } from '../lib/supabase.js';
import { verifyUser, getProfile } from '../lib/auth.js';
import { sendAtomicRpcError } from '../lib/atomic-rpc.js';

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
  
  const { product_id } = req.body || {};
  if (!product_id) return res.status(400).json({ error: 'Product ID is required' });

  const { data, error } = await supabaseAdmin.rpc('buy_product_atomic', {
    p_user_id: userId,
    p_product_id: product_id
  });

  if (error) return sendAtomicRpcError(res, error, 'buy product');
  return res.status(201).json(data);
}
