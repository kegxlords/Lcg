import { createClient } from '@supabase/supabase-js';

// Get environment variables with fallback for development
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';

// Validate configuration
if (!supabaseUrl || supabaseUrl === 'YOUR_SUPABASE_URL') {
  console.error(' LCG Client: Supabase URL not configured. Set VITE_SUPABASE_URL in environment variables.');
}

if (!supabaseAnonKey || supabaseAnonKey === 'YOUR_SUPABASE_ANON_KEY') {
  console.error(' LCG Client: Supabase Anon Key not configured. Set VITE_SUPABASE_ANON_KEY in environment variables.');
}

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

// Helper function to format currency
export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2
  }).format(amount || 0);
};

// Helper function to generate unique reference
export const generateReference = (prefix = 'LCG') => {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
};

export default supabase;
