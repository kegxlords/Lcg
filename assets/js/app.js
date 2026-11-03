/* =================================================================
   LCG — shared app logic (icons, data, helpers, interactions)
   No build step. Vanilla JS. Loaded via <script src>.
   ================================================================= */

/* ---------- Icon set (inline SVG, no external deps) ---------- */
const I = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9 21v-6h6v6"/></svg>',
  plans: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18"/><path d="M9 4v16"/></svg>',
  orders: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>',
  team: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  me: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="5"/><path d="M3 21a9 9 0 0 1 18 0"/></svg>',
  bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>',
  gift: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5"/></svg>',
  wallet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/></svg>',
  deposit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20"/><path d="m17 5-5-3-5 3"/><path d="m7 19 5 3 5-3"/></svg>',
  withdraw: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22V2"/><path d="m7 5 5-3 5 3"/><path d="m7 17 5 3 5-3"/></svg>',
  invite: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="12" r="3"/><path d="M9 12h12"/><path d="m16 8 4 4-4 4"/></svg>',
  vip: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 2 3 7 7 .5-5.5 4.5L18 21l-6-4-6 4 1.5-7L2 9.5 9 9z"/></svg>',
  service: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
  sign: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="m9 16 2 2 4-4"/></svg>',
  wheel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M5.6 18.4 18.4 5.6"/></svg>',
  trophy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9a6 6 0 0 0 12 0V3H6z"/><path d="M6 5H3v2a3 3 0 0 0 3 3M18 5h3v2a3 3 0 0 1-3 3"/><path d="M9 21h6M12 17v4"/></svg>',
  chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m7 14 3-4 3 3 4-6"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5z"/><path d="m9 12 2 2 4-4"/></svg>',
  chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>',
  chevronDown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 7 10 6 10-6"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="5"/><path d="M3 21a9 9 0 0 1 18 0"/></svg>',
  eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>',
  eyeOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.7 5.1A9.5 9.5 0 0 1 12 5c6 0 10 7 10 7a13 13 0 0 1-3 3.5M6.6 6.6A13 13 0 0 0 2 12s4 7 10 7a9 9 0 0 0 4-1M3 3l18 18"/></svg>',
  phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.7a2 2 0 0 1-.5 2.1L8 9.6a16 16 0 0 0 6 6l1.1-1.1a2 2 0 0 1 2.1-.5c.9.3 1.8.5 2.7.6a2 2 0 0 1 1.7 2z"/></svg>',
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5 8.6 10.5"/></svg>',
  download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5M12 15V3"/></svg>',
  refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>',
  arrowUp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
  arrowDown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>',
  arrowLeft: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>',
  logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
  card: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>',
  bank: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-6 9 6"/><path d="M4 9v11M20 9v11M8 9v11M12 9v11M16 9v11M3 21h18"/></svg>',
  qr: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3M21 14v3M17 21h4M14 21h0"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h0"/></svg>',
  sparkle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v6M12 16v6M2 12h6M16 12h6M5 5l4 4M15 15l4 4M19 5l-4 4M5 19l4-4"/></svg>',
  settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.65 1.65 0 0 0-1.8-.3 1.65 1.65 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.65 1.65 0 0 0-1-1.5 1.65 1.65 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.65 1.65 0 0 0 .3-1.8 1.65 1.65 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.65 1.65 0 0 0 1.5-1 1.65 1.65 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.65 1.65 0 0 0 1.8.3h0a1.65 1.65 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.65 1.65 0 0 0 1 1.5 1.65 1.65 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.65 1.65 0 0 0-.3 1.8v0a1.65 1.65 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.65 1.65 0 0 0-1.5 1z"/></svg>',
  help: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h0"/></svg>',
  moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/></svg>',
  history: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v6h6"/><path d="M3.5 9a9 9 0 1 0 2.1-3.4L3 9"/><path d="M12 7v5l3 2"/></svg>',
  coin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M14.5 9.5a2.5 2.5 0 0 0-2.5-1.5c-1.4 0-2.5.9-2.5 2s1.1 2 2.5 2 2.5.9 2.5 2-1.1 2-2.5 2A2.5 2.5 0 0 1 9.5 14.5M12 6v1.5M12 16.5V18"/></svg>',
  fire: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2c1 3 3 5 3 8a3 3 0 0 1-6 0c0-1 .5-2 1-3-2 1-4 3-4 7a6 6 0 0 0 12 0c0-5-4-8-6-12z"/></svg>',
  bolt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg>',
  star: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 2 3 7 7 .5-5.5 4.5L18 21l-6-4-6 4 1.5-7L2 9.5 9 9z"/></svg>',
  ticket: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2z"/><path d="M13 5v14"/></svg>',
};

/* ---------- Currency formatter ---------- */
const naira = (n) => '₦' + Number(n || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nairaShort = (n) => {
  if (n >= 1e9) return '₦' + (n/1e9).toFixed(2) + 'B';
  if (n >= 1e6) return '₦' + (n/1e6).toFixed(2) + 'M';
  if (n >= 1e3) return '₦' + (n/1e3).toFixed(1) + 'K';
  return '₦' + n.toFixed(0);
};

/* ---------- Mock platform data ---------- */
const LCG = {
  user: {
    name: 'Adaeze Okonkwo',
    uid: 'LCG-849213',
    email: 'adaeze.ok@lcg.io',
    phone: '+234 803 ••• 4190',
    avatar: 'A',
    vip: { level: 2, name: 'Gold' },
    available: 8900,
    earnings: 8700,
    invested: 142500,
    totalEarned: 28940,
    teamSize: 34,
    referralCode: 'ADAEZE-LCG',
    invited: 12,
    joined: 'Jan 2026',
    checkinStreak: 7,
  },
  plans: [
    { id: 'g1', name: 'Starter Yield', cat: 'general', min: 5000, max: 50000, daily: 2.5, days: 30, total: 75, accent: 'jade', badge: null,
      perks: ['Daily payouts', 'Withdraw after 7 days', 'Capital return at maturity'] },
    { id: 'g2', name: 'Growth Engine', cat: 'general', min: 51000, max: 200000, daily: 2.8, days: 45, total: 126, accent: 'jade', badge: 'Popular',
      perks: ['Daily payouts', 'Priority withdrawals', 'Free referral tools'] },
    { id: 'g3', name: 'Meridian Core', cat: 'general', min: 201000, max: 800000, daily: 3.1, days: 60, total: 186, accent: 'jade', badge: null,
      perks: ['Daily payouts', 'Dedicated account manager', 'Capital insurance'] },
    { id: 'w1', name: 'Welfare Boost', cat: 'welfare', min: 2000, max: 20000, daily: 3.5, days: 15, total: 52.5, accent: 'jade', badge: 'Low entry',
      perks: ['Entry-level friendly', '15-day fast cycle', 'Daily payouts'] },
    { id: 'w2', name: 'Community Fund', cat: 'welfare', min: 1000, max: 8000, daily: 4, days: 10, total: 40, accent: 'jade', badge: null,
      perks: ['Weekend bonus ×1.2', 'Community chat access', 'Daily payouts'] },
    { id: 'l1', name: 'Obsidian Series', cat: 'limited', min: 100000, max: 1500000, daily: 3.8, days: 40, total: 152, accent: 'gold', badge: 'Limited',
      perks: ['Only 500 slots', 'VIP fast-track support', 'Quarterly dividend share'] },
    { id: 'l2', name: 'Aurum Private', cat: 'limited', min: 500000, max: 5000000, daily: 4.2, days: 50, total: 210, accent: 'gold', badge: 'Invited',
      perks: ['Private placement', 'Offshore allocation', '1-on-1 wealth review'] },
    { id: 'l3', name: 'Twilight Vault', cat: 'limited', min: 300000, max: 2000000, daily: 4, days: 35, total: 140, accent: 'gold', badge: null, sold: true,
      perks: ['Reopening soon', 'Join waitlist'] },
  ],
  investments: [
    { plan: 'Growth Engine', amount: 100000, daily: 2800, days: 45, day: 18, status: 'active' },
    { plan: 'Starter Yield', amount: 30000, daily: 750, days: 30, day: 22, status: 'active' },
    { plan: 'Community Fund', amount: 5000, daily: 200, days: 10, day: 10, status: 'done' },
    { plan: 'Obsidian Series', amount: 150000, daily: 5700, days: 40, day: 6, status: 'active' },
  ],
  transactions: [
    { type: 'Investment payout', sub: 'Growth Engine · Day 18', amt: 2800, dir: 'in', ts: '2h ago', ic: 'coin', tone: 'jade' },
    { type: 'Referral bonus', sub: 'Chidi D. joined', amt: 180, dir: 'in', ts: '5h ago', ic: 'gift', tone: 'jade' },
    { type: 'Withdrawal', sub: 'To GTBank ••2841', amt: 5000, dir: 'out', ts: '1d ago', ic: 'withdraw', tone: 'rose' },
    { type: 'Deposit', sub: 'Card · Visa ••9203', amt: 10000, dir: 'in', ts: '1d ago', ic: 'deposit', tone: 'jade' },
    { type: 'Investment payout', sub: 'Starter Yield · Day 22', amt: 750, dir: 'in', ts: '2d ago', ic: 'coin', tone: 'jade' },
    { type: 'Lucky wheel reward', sub: 'Daily spin', amt: 120, dir: 'in', ts: '2d ago', ic: 'wheel', tone: 'gold' },
  ],
  leaderboard: [
    { name: 'Kunle A.', uid: 'LCG-771022', amt: 1840000, vip: 'Diamond', avatar: 'K', tone: 'violet' },
    { name: 'Fatima B.', uid: 'LCG-662104', amt: 1420000, vip: 'Platinum', avatar: 'F', tone: 'silver' },
    { name: 'Tunde O.', uid: 'LCG-559810', amt: 980000, vip: 'Platinum', avatar: 'T', tone: 'silver' },
    { name: 'Adaeze O.', uid: 'LCG-849213', amt: 28940, vip: 'Gold', avatar: 'A', tone: 'gold', me: true },
    { name: 'Bola S.', uid: 'LCG-410887', amt: 642000, vip: 'Gold', avatar: 'B', tone: 'gold' },
    { name: 'Emeka N.', uid: 'LCG-390221', amt: 511000, vip: 'Gold', avatar: 'E', tone: 'gold' },
    { name: 'Zainab M.', uid: 'LCG-288540', amt: 433000, vip: 'Gold', avatar: 'Z', tone: 'gold' },
    { name: 'Chidi D.', uid: 'LCG-177302', amt: 318000, vip: 'Silver', avatar: 'C', tone: 'silver' },
  ],
  tiers: [
    { level: 1, name: 'Silver', color: 'silver', dailyLimit: 100000, fee: 2, req: '₦50,000 lifetime deposits', team: 5,
      perks: ['2% withdrawal fee', 'Standard support', '₦100k daily limit'] },
    { level: 2, name: 'Gold', color: 'gold', dailyLimit: 500000, fee: 1.2, req: '₦250k deposits · 20 team', team: 20, current: true,
      perks: ['1.2% withdrawal fee', 'Priority support', '0.5% weekly cashback', 'Gold badge'] },
    { level: 3, name: 'Platinum', color: 'silver', dailyLimit: 2000000, fee: 0.6, req: '₦1M deposits · 80 team', team: 80,
      perks: ['0.6% withdrawal fee', 'VIP concierge', '1.5% weekly cashback', 'Exclusive plans'] },
    { level: 4, name: 'Diamond', color: 'silver', dailyLimit: 10000000, fee: 0, req: '₦5M deposits · 250 team', team: 250,
      perks: ['Zero withdrawal fee', 'Private banking', '3% weekly cashback', 'Founders access'] },
  ],
  team: [
    { name: 'Chidi D.', uid: 'LCG-177302', tier: 'Gold', joined: '3d ago', earned: 4200, active: true, avatar: 'C', tone: 'gold' },
    { name: 'Ngozi E.', uid: 'LCG-209331', tier: 'Silver', joined: '1w ago', earned: 1800, active: true, avatar: 'N', tone: 'silver' },
    { name: 'Samuel K.', uid: 'LCG-300922', tier: 'Silver', joined: '2w ago', earned: 950, active: false, avatar: 'S', tone: 'silver' },
    { name: 'Aisha M.', uid: 'LCG-411058', tier: 'Gold', joined: '3w ago', earned: 8700, active: true, avatar: 'A', tone: 'gold' },
    { name: 'David O.', uid: 'LCG-522140', tier: 'Silver', joined: '1m ago', earned: 320, active: false, avatar: 'D', tone: 'silver' },
  ],
  wheelPrizes: [
    { label: '₦500', tone: 'jade', val: 500 },
    { label: '2× spin', tone: 'gold', val: 0 },
    { label: '₦50', tone: 'jade', val: 50 },
    { label: 'VIP +5%', tone: 'violet', val: 0 },
    { label: '₦1,000', tone: 'gold', val: 1000 },
    { label: '₦100', tone: 'jade', val: 100 },
    { label: 'Try again', tone: 'muted', val: 0 },
    { label: '₦250', tone: 'jade', val: 250 },
  ],
  faqs: [
    { q: 'How do investment payouts work?', a: 'Each plan pays daily returns directly to your earnings balance. You can withdraw earnings anytime after the 7-day lock period. Capital is returned at the end of the cycle.' },
    { q: 'What is the minimum deposit?', a: 'The minimum deposit is ₦1,000 for welfare plans, and ₦5,000 for general investment plans. Limited series start at ₦100,000.' },
    { q: 'How long do withdrawals take?', a: 'Withdrawals are processed within 30 minutes during business hours (8am–10pm WAT). Off-hours requests process the next morning. VIP tiers receive priority.' },
    { q: 'How do referral bonuses work?', a: 'You earn 10% of your direct team\'s deposits and 3% of second-level referrals. Bonuses are credited instantly to your earnings balance and are withdrawable immediately.' },
    { q: 'Is my capital insured?', a: 'Capital for plans above ₦200,000 is covered by the LCG Investor Protection Fund. Welfare and entry plans carry standard protection.' },
    { q: 'How do I upgrade my VIP tier?', a: 'VIP tiers upgrade automatically when you meet the lifetime deposit and team-size thresholds. You can track progress on the VIP page.' },
  ],
  rates: [
    { k: 'USD/NGN', v: '1,612.40', d: '+0.32%', up: true },
    { k: 'LCG Index', v: '4,201.50', d: '+1.84%', up: true },
    { k: 'Avg Yield', v: '3.18%', d: '+0.06%', up: true },
    { k: 'Payouts 24h', v: '₦2.4M', d: '+12%', up: true },
  ],
};

/* ---------- Toast ---------- */
function toast(msg, type = 'ok') {
  let area = document.querySelector('.toast-area');
  if (!area) {
    area = document.createElement('div');
    area.className = 'toast-area';
    document.body.appendChild(area);
  }
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  const ic = type === 'ok' ? I.check : type === 'err' ? I.info : I.info;
  t.innerHTML = '<span class="ic">' + ic + '</span><span>' + msg + '</span>';
  area.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateY(-8px)'; t.style.transition = '0.3s'; }, 2600);
  setTimeout(() => t.remove(), 3000);
}

/* ---------- Reusable partials ---------- */
function topbarHTML(active) {
  return `
    <header class="topbar">
      <a href="dashboard.html" class="brand">
        <span class="logo-dot">L</span>
        <span>LCG</span>
      </a>
      <div class="flex center gap-2">
        <div class="balance-chip">
          <span class="dot"></span>
          <span>${naira(LCG.user.available)}</span>
        </div>
        <a href="#" class="icon-btn" onclick="toast('No new notifications','info');return false;" aria-label="Notifications">
          ${I.bell}
          <span class="badge-dot"></span>
        </a>
      </div>
    </header>`;
}

function bottomNavHTML(active) {
  const items = [
    { key: 'home', label: 'Home', icon: I.home, href: 'dashboard.html' },
    { key: 'plans', label: 'Plans', icon: I.plans, href: 'products.html' },
    { key: 'orders', label: 'Orders', icon: I.orders, href: 'investments.html' },
    { key: 'team', label: 'Team', icon: I.team, href: 'team.html' },
    { key: 'me', label: 'My', icon: I.me, href: 'profile.html' },
  ];
  return `<nav class="bottom-nav">` + items.map(it => `
    <a class="bn-item ${active === it.key ? 'active' : ''}" href="${it.href}">
      ${it.icon}
      <span>${it.label}</span>
    </a>`).join('') + `</nav>`;
}

/* ---------- Carousel ---------- */
function initCarousel() {
  const b = document.querySelector('[data-carousel]');
  if (!b) return;
  const slides = b.querySelectorAll('.slide');
  const dots = b.querySelectorAll('.dots i');
  let i = 0;
  setInterval(() => {
    slides[i].classList.remove('on');
    if (dots[i]) dots[i].classList.remove('on');
    i = (i + 1) % slides.length;
    slides[i].classList.add('on');
    if (dots[i]) dots[i].classList.add('on');
  }, 4500);
}

/* ---------- Tabs ---------- */
function initTabs() {
  document.querySelectorAll('[data-tabs]').forEach(group => {
    const tabs = group.querySelectorAll('.tab');
    const target = group.dataset.tabs;
    tabs.forEach(t => {
      t.addEventListener('click', () => {
        tabs.forEach(x => x.classList.remove('active'));
        t.classList.add('active');
        const cat = t.dataset.cat;
        const panel = document.querySelector('[data-tab-panel="' + target + '"]');
        if (panel) {
          panel.querySelectorAll('[data-cat]').forEach(el => {
            el.style.display = (cat === 'all' || el.dataset.cat === cat) ? '' : 'none';
          });
        }
      });
    });
  });
}

/* ---------- FAQ accordion ---------- */
function initFAQ() {
  document.querySelectorAll('.faq').forEach(f => {
    f.querySelector('.q').addEventListener('click', () => {
      f.classList.toggle('open');
    });
  });
}

/* ---------- Password toggle ---------- */
function initPasswordToggles() {
  document.querySelectorAll('[data-pw-toggle]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.pwToggle;
      const input = document.getElementById(id);
      if (!input) return;
      if (input.type === 'password') { input.type = 'text'; btn.innerHTML = I.eyeOff; }
      else { input.type = 'password'; btn.innerHTML = I.eye; }
    });
  });
}

/* ---------- Copy to clipboard ---------- */
function copyText(text, label) {
  navigator.clipboard?.writeText(text).then(() => toast((label || 'Copied') + ' to clipboard', 'ok'));
}

/* ---------- Spin wheel ---------- */
let wheelSpinning = false;
function spinWheel() {
  if (wheelSpinning) return;
  const w = document.querySelector('[data-wheel]');
  if (!w) return;
  wheelSpinning = true;
  const seg = 360 / LCG.wheelPrizes.length;
  const idx = Math.floor(Math.random() * LCG.wheelPrizes.length);
  const turns = 5 + Math.floor(Math.random() * 3);
  const target = turns * 360 + (360 - idx * seg - seg / 2);
  w.style.transform = 'rotate(' + target + 'deg)';
  setTimeout(() => {
    const prize = LCG.wheelPrizes[idx];
    if (prize.val > 0) toast('You won ' + prize.label + '!', 'ok');
    else toast(prize.label === 'Try again' ? 'No luck this time. Spin again tomorrow!' : 'You won ' + prize.label + '!', 'info');
    wheelSpinning = false;
  }, 4600);
}

/* ---------- Checkin ---------- */
function doCheckin() {
  LCG.user.checkinStreak += 1;
  const reward = 50 + LCG.user.checkinStreak * 10;
  toast('Checked in! +' + naira(reward) + ' (streak ' + LCG.user.checkinStreak + ' days)', 'ok');
  const el = document.querySelector('[data-streak]');
  if (el) el.textContent = LCG.user.checkinStreak;
}

/* ---------- Boot ---------- */
document.addEventListener('DOMContentLoaded', () => {
  initCarousel();
  initTabs();
  initFAQ();
  initPasswordToggles();
});
