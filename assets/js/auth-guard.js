import { supabase } from './lcg-client.js';

/**
 * Require authentication - redirect to login if not authenticated
 * @returns {Promise<User|null>} - Returns user object or null if redirecting
 */
export async function requireAuth() {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('Session error:', error);
      redirectToLogin();
      return null;
    }
    
    if (!session) {
      redirectToLogin();
      return null;
    }
    
    return session.user;
  } catch (error) {
    console.error('Auth guard error:', error);
    redirectToLogin();
    return null;
  }
}

/**
 * Require admin authentication
 * @returns {Promise<User|null>} - Returns user object if admin, null otherwise
 */
export async function requireAdmin() {
  const user = await requireAuth();
  if (!user) return null;
  
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();
    
    if (error || !profile?.is_admin) {
      // Not an admin - redirect to dashboard
      window.location.href = '/app/dashboard.html';
      return null;
    }
    
    return user;
  } catch (error) {
    console.error('Admin check error:', error);
    window.location.href = '/app/dashboard.html';
    return null;
  }
}

/**
 * Get user profile data
 * @param {string} userId - User ID
 * @returns {Promise<Object|null>} - Profile data or null
 */
export async function getProfile(userId) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (error) {
      console.error('Get profile error:', error);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('Get profile error:', error);
    return null;
  }
}

/**
 * Get user wallet balance
 * @param {string} userId - User ID
 * @returns {Promise<number>} - Wallet balance
 */
export async function getWalletBalance(userId) {
  try {
    const { data, error } = await supabase
      .from('wallets')
      .select('balance')
      .eq('user_id', userId)
      .single();
    
    if (error || !data) {
      console.error('Get wallet error:', error);
      return 0;
    }
    
    return data.balance || 0;
  } catch (error) {
    console.error('Get wallet error:', error);
    return 0;
  }
}

/**
 * Redirect to login page
 */
function redirectToLogin() {
  const currentPath = window.location.pathname;
  if (!currentPath.includes('index.html') && !currentPath.includes('register.html')) {
    window.location.href = `/index.html?redirect=${encodeURIComponent(currentPath)}`;
  }
}

/**
 * Check if user is authenticated (without redirect)
 * @returns {Promise<boolean>}
 */
export async function isAuthenticated() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return !!session;
  } catch (error) {
    console.error('Is authenticated error:', error);
    return false;
  }
}

export default { requireAuth, requireAdmin, getProfile, getWalletBalance, isAuthenticated };
