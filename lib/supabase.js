import { createClient } from '@supabase/supabase-js';
let client;
export function browserClient() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) throw new Error('Live sign-in is not configured. Follow the Supabase setup in README.md.');
  client ||= createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  return client;
}
// Password links. Supabase's reset ("recovery") and invitation links arrive with #...&type=recovery or type=invite in
// the address. They must always end on the login page's "Set your password" form.
export function passwordLinkType(location) {
  try { const type = new URLSearchParams(String(location?.hash || '').replace(/^#/, '')).get('type'); return type === 'recovery' || type === 'invite' ? type : null; } catch { return null; }
}
export function onPasswordForm(location) {
  const params = new URLSearchParams(String(location?.search || ''));
  return location?.pathname === '/login' && (params.has('set-password') || params.get('mode') === 'reset');
}
export function passwordFormPath(type) { return type === 'invite' ? '/login?set-password=1' : '/login?mode=reset'; }
