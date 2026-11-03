import { supabase } from './lcg-client.js';

/**
 * Upload an image to Supabase Storage and return the public URL
 */
export async function uploadImage(file, ticketId) {
  if (!file) return null;
  
  const fileExt = file.name.split('.').pop();
  const fileName = `${ticketId}_${Date.now()}.${fileExt}`;
  const filePath = `${fileName}`;

  const { error } = await supabase.storage
    .from('support-images')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false
    });

  if (error) throw error;

  const { data } = supabase.storage.from('support-images').getPublicUrl(filePath);
  return data.publicUrl;
}

/**
 * Render a single message bubble
 */
export function renderMessage(msg) {
  const isUser = msg.sender_type === 'user';
  const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  
  let imageHtml = '';
  if (msg.image_url) {
    imageHtml = `<img src="${msg.image_url}" class="message-image" onclick="window.open('${msg.image_url}', '_blank')" alt="Attachment">`;
  }

  return `
    <div class="message-bubble ${isUser ? 'user' : 'admin'}">
      <div>${msg.message.replace(/\n/g, '<br>')}</div>
      ${imageHtml}
      <span class="message-time">${time}</span>
    </div>
  `;
}
