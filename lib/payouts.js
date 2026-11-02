// lib/payouts.js

/**
 * Calculate the daily payout amount for a product
 */
export function calculateDailyPayout(profit, durationDays) {
  if (!durationDays || durationDays <= 0) return 0;
  return Number(profit) / Number(durationDays);
}

/**
 * Calculate total return (Capital + Profit) for lump sum
 */
export function calculateLumpSumReturn(amount, profit) {
  return Number(amount) + Number(profit);
}

/**
 * Check if a daily investment is ready for payout (24h passed)
 */
export function isDailyPayoutDue(lastPayoutDate) {
  if (!lastPayoutDate) return true; // First payout
  const last = new Date(lastPayoutDate).getTime();
  const now = Date.now();
  const msPerDay = 24 * 60 * 60 * 1000;
  return (now - last) >= msPerDay;
}

/**
 * Check if a lump sum investment has matured
 */
export function isLumpSumMature(endDate) {
  if (!endDate) return false;
  return new Date() >= new Date(endDate);
}
