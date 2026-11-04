import { supabaseAdmin } from './supabase.js';

/**
 * Verify user from Bearer token in request headers
 */
export async function verifyUser(req) {
  const headers = req?.headers;
  const authHeader = typeof headers?.get === 'function'
    ? headers.get('authorization')
    : headers?.authorization ?? req?.get?.('authorization');
  if (!authHeader) return null;

  const match = /^Bearer\s+(.+)$/i.exec(String(authHeader).trim());
  if (!match) return null;
  const token = match[1];
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  
  if (error || !user) return null;
  return user;
}

/**
 * Check if user is admin
 */
export async function isAdmin(userId) {
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('is_admin')
    .eq('id', userId)
    .single();
  return profile?.is_admin === true;
}

/**
 * Get full profile
 */
export async function getProfile(userId) {
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  return data;
}
