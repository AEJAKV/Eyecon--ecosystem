import 'server-only';
import { newBookingIds } from './seen.js';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// The ids of bookings that are new to this user (migration 017). An affiliate only ever gets ids of their own referrals.
// The first time a user loads the workspace their seen time is set to now, so nothing old is flagged. Before migration
// 017 has run the tables are missing and nothing is flagged; the workspace still loads.
export async function loadNewIds(db, userId, affiliateId = null) {
  const s = await db.from('workspace_seen').select('seen_at').eq('user_id', userId).maybeSingle();
  if (s.error) return [];
  if (!s.data) { await db.from('workspace_seen').insert({ user_id: userId }); return []; }
  let q = db.from('bookings').select('id,created_at').gt('created_at', s.data.seen_at).order('created_at', { ascending: false }).limit(200);
  if (affiliateId) q = q.eq('affiliate_id', affiliateId);
  const [b, v] = await Promise.all([q, db.from('booking_views').select('booking_id').eq('user_id', userId).gt('viewed_at', s.data.seen_at)]);
  if (b.error || v.error) return [];
  return newBookingIds(b.data.map(r => ({ id: r.id, createdAt: r.created_at })), s.data.seen_at, (v.data || []).map(r => r.booking_id));
}
// "Mark all seen" (no id), or one booking opened (id). Affiliates can only mark all seen.
export async function markSeen(db, userId, id, affiliate) {
  if (!id || affiliate) {
    const { error } = await db.from('workspace_seen').upsert({ user_id: userId, seen_at: new Date().toISOString() });
    if (error) throw new Error('Could not update new bookings.');
    return;
  }
  if (typeof id !== 'string' || !UUID.test(id)) throw new Error('Booking not found.');
  const { error } = await db.from('booking_views').upsert({ user_id: userId, booking_id: id, viewed_at: new Date().toISOString() });
  if (error) throw new Error('Could not update new bookings.');
}
