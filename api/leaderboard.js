import { supabaseAdmin } from '../lib/supabase.js';
import { verifyUser } from '../lib/auth.js';

export default async function handler(req, res) {
  try {
    const user = await verifyUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, total_team_deposit')
      .order('total_team_deposit', { ascending: false })
      .limit(10);

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ leaderboard: data || [] });
  } catch (error) {
    console.error('[API Leaderboard Error]:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
