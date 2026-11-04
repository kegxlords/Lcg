import { supabaseAdmin } from '../lib/supabase.js';
import { verifyUser } from '../lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const user = await verifyUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, email, referral_code, total_personal_deposit, total_team_deposit, active_downlines, created_at')
      .eq('id', user.id)
      .maybeSingle();

    if (error) return res.status(500).json({ error: 'Could not load profile.' });
    return res.json({
      user: {
        id: user.id,
        email: user.email || profile?.email || '',
        phone: user.phone || user.user_metadata?.phone || user.user_metadata?.phone_number || ''
      },
      profile: profile || null
    });
  } catch (error) {
    console.error('[API Profile Error]:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
