import { supabase } from './lcg-client.js';

/**
 * 1. REQUIRE AUTHENTICATION
 * Checks if a user is logged in. If not, redirects to the login page.
 * @returns {Promise<Object|null>} The Supabase User object, or null if redirecting.
 */
export async function requireAuth() {
  try {
    // Get the current session from Supabase
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error) {
      console.error('❌ Auth Guard: Session error', error.message);
      redirectToLogin();
      return null;
    }

    // If no session exists, redirect to login
    if (!session) {
      console.warn('⚠️ Auth Guard: No session found. Redirecting to login...');
      redirectToLogin();
      return null;
    }

    // Session exists, return the user
    return session.user;

  } catch (err) {
    console.error('❌ Auth Guard: Unexpected error', err);
    redirectToLogin();
    return null;
  }
}

/**
 * 2. REQUIRE ADMIN
 * Checks if the logged-in user has admin privileges.
 * @returns {Promise<Object|null>} The User object if admin, null if redirected.
 */
export async function requireAdmin() {
  // First, ensure they are logged in
  const user = await requireAuth();
  if (!user) return null;

  try {
    // Fetch their profile to check the is_admin flag
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (error) {
      console.error('❌ Auth Guard: Error fetching profile', error.message);
      // Fallback: kick them to dashboard if we can't verify admin status
      window.location.href = '/app/dashboard.html';
      return null;
    }

    // Check if they are actually an admin
    if (!profile || !profile.is_admin) {
      console.warn('⚠️ Auth Guard: User is not an admin. Redirecting to dashboard...');
      window.location.href = '/app/dashboard.html';
      return null;
    }

    // They are an admin
    return user;

  } catch (err) {
    console.error('❌ Auth Guard: Admin check failed', err);
    window.location.href = '/app/dashboard.html';
    return null;
  }
}

/**
 * 3. GET CURRENT USER (Non-blocking)
 * Returns the user if logged in, but DOES NOT redirect if they aren't.
 * Useful for pages that show different content for guests vs logged-in users.
 */
export async function getCurrentUser() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user || null;
}

/**
 * 4. GET USER PROFILE
 * Fetches the full profile row for a specific user ID.
 */
export async function getUserProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('❌ Auth Guard: Failed to fetch profile', error.message);
    return null;
  }
  return data;
}

/**
 * 5. LOGOUT HELPER
 * Clears the session and redirects to the login page.
 */
export async function logout() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error('❌ Logout error:', error.message);
  }
  // Clear any local storage just in case
  localStorage.clear();
  window.location.href = '/index.html';
}

// ==========================================
// INTERNAL HELPERS
// ==========================================

/**
 * Redirects to login page, preventing infinite loops if already there.
 */
function redirectToLogin() {
  const currentPath = window.location.pathname;
  const publicPages = ['/', '/index.html', '/register.html', '/forgot.html'];
  
  // Only redirect if we aren't already on a public auth page
  if (!publicPages.includes(currentPath)) {
    window.location.href = `/index.html?redirect=${encodeURIComponent(currentPath)}`;
  }
}
