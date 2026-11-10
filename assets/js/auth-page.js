import { supabase } from './lcg-client.js';

const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');

function setBusy(form, busy, label) {
  const button = form?.querySelector('button[type="submit"]');
  if (!button) return;
  if (!button.dataset.originalLabel) button.dataset.originalLabel = button.textContent;
  button.disabled = busy;
  button.textContent = busy ? label : button.dataset.originalLabel;
}

function showError(message) {
  if (typeof toast === 'function') toast(message, 'err');
  else window.alert(message);
}

function dashboardUrl() {
  const redirect = new URLSearchParams(window.location.search).get('redirect');
  return redirect && redirect.startsWith('/') ? redirect : 'app/dashboard.html';
}

if (loginForm) {
  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('pw').value;
    setBusy(loginForm, true, 'Signing in…');

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      window.location.assign(dashboardUrl());
    } catch (error) {
      console.error('Sign-in failed:', error);
      showError(error.message || 'Unable to sign in. Please check your details.');
      setBusy(loginForm, false);
    }
  });
}

if (registerForm) {
  const referralInput = document.getElementById('ref');
  const referralFromUrl = new URLSearchParams(window.location.search).get('ref');
  if (referralInput && referralFromUrl && !referralInput.value.trim()) {
    referralInput.value = referralFromUrl.trim().toUpperCase();
  }

  registerForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const fullName = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const password = document.getElementById('pw').value;
    const referralCode = document.getElementById('ref').value.trim().toUpperCase();
    const agreed = document.getElementById('agree').classList.contains('on');

    if (password.length < 8 || !/\d/.test(password) || !/[A-Z]/.test(password)) {
      showError('Use at least 8 characters, including one number and one uppercase letter.');
      return;
    }
    if (!agreed) {
      showError('Please agree to the terms before creating your account.');
      return;
    }

    setBusy(registerForm, true, 'Creating account…');
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            phone,
            referral_code: referralCode || null
          }
        }
      });
      if (error) throw error;

      if (data.session) {
        window.location.assign('app/dashboard.html');
      } else {
        toast('Account created. Check your email to confirm it, then sign in.', 'ok');
        setBusy(registerForm, false);
        setTimeout(() => window.location.assign('index.html'), 1600);
      }
    } catch (error) {
      console.error('Registration failed:', error);
      showError(error.message || 'Unable to create your account.');
      setBusy(registerForm, false);
    }
  });
}
