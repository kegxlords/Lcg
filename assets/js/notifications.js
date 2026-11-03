// Initialize container
if (!document.getElementById('toast-container')) {
  const container = document.createElement('div');
  container.id = 'toast-container';
  document.body.appendChild(container);
}

/**
 * Show a toast notification
 * @param {string} message - The text to display
 * @param {'success'|'error'|'warning'} type - The style type
 * @param {number} duration - Time in ms before disappearing (default 3500)
 */
window.showToast = (message, type = 'success', duration = 3500) => {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let icon = 'fa-circle-check';
  if (type === 'error') icon = 'fa-circle-exclamation';
  if (type === 'warning') icon = 'fa-triangle-exclamation';

  toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'fadeOut 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, duration);
};
