import { supabaseAdmin } from '../lib/supabase.js';
import { verifyUser } from '../lib/auth.js';

export default async function handler(req, res) {
  const action = req.query.action;
  
  try {
    const user = await verifyUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    switch (action) {
      case 'getTickets': return await getTickets(user.id, res);
      case 'createTicket': return await createTicket(req, user.id, res);
      case 'getMessages': return await getMessages(req, user.id, res);
      case 'sendMessage': return await sendMessage(req, user.id, res);
      default: return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    console.error('[API Support Error]:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function getTickets(userId, res) {
  const { data, error } = await supabaseAdmin
    .from('support_tickets')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ tickets: data || [] });
}

async function createTicket(req, userId, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { subject, message, image_url } = req.body;

  if (!subject || !message) return res.status(400).json({ error: 'Subject and message are required' });

  // 1. Create Ticket
  const { data: ticket, error: ticketError } = await supabaseAdmin
    .from('support_tickets')
    .insert({ user_id: userId, subject, status: 'open' })
    .select()
    .single();
  if (ticketError) return res.status(500).json({ error: ticketError.message });

  // 2. Send First Message
  await supabaseAdmin.from('support_messages').insert({
    ticket_id: ticket.id,
    sender_type: 'user',
    message,
    image_url: image_url || null
  });

  return res.status(201).json({ success: true, ticket });
}

async function getMessages(req, userId, res) {
  const ticketId = req.query.ticket_id;
  if (!ticketId) return res.status(400).json({ error: 'Ticket ID required' });

  // Verify ownership
  const { data: ticket } = await supabaseAdmin.from('support_tickets').select('user_id').eq('id', ticketId).single();
  if (!ticket || ticket.user_id !== userId) return res.status(403).json({ error: 'Access denied' });

  const { data, error } = await supabaseAdmin
    .from('support_messages')
    .select('*')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true });
  
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ messages: data || [] });
}

async function sendMessage(req, userId, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { ticket_id, message, image_url } = req.body;

  // Verify ownership
  const { data: ticket } = await supabaseAdmin.from('support_tickets').select('user_id').eq('id', ticket_id).single();
  if (!ticket || ticket.user_id !== userId) return res.status(403).json({ error: 'Access denied' });

  const { error } = await supabaseAdmin.from('support_messages').insert({
    ticket_id, sender_type: 'user', message, image_url: image_url || null
  });

  if (error) return res.status(500).json({ error: error.message });
  
  // Re-open ticket if it was resolved
  await supabaseAdmin.from('support_tickets').update({ status: 'open' }).eq('id', ticket_id);

  return res.json({ success: true });
}
