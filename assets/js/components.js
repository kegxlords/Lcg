import { supabase } from './lcg-client.js';
import { formatCurrency } from './lcg-client.js';

/**
 * Load the application shell (header and navigation)
 */
export async function loadShell() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get user profile and wallet balance
    const [{ data: profile }, { data: wallet }] = await Promise.all([
      supabase.from('profiles').select('full_name').eq('id', user.id).single(),
      supabase.from('wallets').select('balance').eq('user_id', user.id).single()
    ]);

    const balance = wallet?.balance || 0;
    const fullName = profile?.full_name || user.email?.split('@')[0] || 'User';

    // Inject header
    const headerHTML = `
      <header class="app-header">
        <div class="header-left">
          <div class="logo">
            <span class="logo-icon">L</span>
            <span class="logo-text">LCG</span>
          </div>
        </div>
        <div class="header-right">
          <div class="balance-chip">
            <i class="fa-solid fa-wallet"></i>
            <span class="balance-amount">${formatCurrency(balance)}</span>
          </div>
          <div class="user-info">
            <span class="user-name">${fullName}</span>
          </div>
        </div>
      </header>
    `;

    // Inject bottom navigation
    const currentPath = window.location.pathname;
    const navHTML = `
      <nav class="bottom-nav">
        <a href="/app/dashboard.html" class="nav-item ${currentPath.includes('dashboard') ? 'active' : ''}">
          <i class="fa-solid fa-house"></i>
          <span>Home</span>
        </a>
        <a href="/app/products.html" class="nav-item ${currentPath.includes('products') ? 'active' : ''}">
          <i class="fa-solid fa-box-open"></i>
          <span>Products</span>
        </a>
        <a href="/app/wheel.html" class="nav-item ${currentPath.includes('wheel') ? 'active' : ''}">
          <i class="fa-solid fa-dharmachakra"></i>
          <span>Wheel</span>
        </a>
        <a href="/app/team.html" class="nav-item ${currentPath.includes('team') ? 'active' : ''}">
          <i class="fa-solid fa-users"></i>
          <span>Team</span>
        </a>
        <a href="/app/profile.html" class="nav-item ${currentPath.includes('profile') ? 'active' : ''}">
          <i class="fa-solid fa-user"></i>
          <span>Profile</span>
        </a>
      </nav>
    `;

    // Insert into DOM
    document.body.insertAdjacentHTML('afterbegin', headerHTML);
    document.body.insertAdjacentHTML('beforeend', navHTML);

    // Add padding to body for fixed header and nav
    document.body.style.paddingTop = '70px';
    document.body.style.paddingBottom = '80px';

  } catch (error) {
    console.error('Load shell error:', error);
  }
}

/**
 * Update balance in header (call this after any balance change)
 * @param {number} newBalance 
 */
export async function updateBalance(newBalance) {
  const balanceElement = document.querySelector('.balance-amount');
  if (balanceElement) {
    balanceElement.textContent = formatCurrency(newBalance);
    
    // Add animation
    balanceElement.classList.add('balance-updated');
    setTimeout(() => balanceElement.classList.remove('balance-updated'), 1000);
  }
}

/**
 * Show loading state
 * @param {string} message 
 */
export function showLoading(message = 'Loading...') {
  const loadingHTML = `
    <div class="loading-overlay" id="loading-overlay">
      <div class="loading-content">
        <i class="fa-solid fa-circle-notch fa-spin"></i>
        <p>${message}</p>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', loadingHTML);
}

/**
 * Hide loading state
 */
export function hideLoading() {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) {
    overlay.remove();
  }
}

export default { loadShell, updateBalance, showLoading, hideLoading };
