// New-booking indicators (the gold dot). Each workspace user has their own "seen" state: a booking is new to them when
// it was made after they last pressed "Mark all seen" (seenAt) and they have not opened it since (viewed). With no
// seenAt yet nothing is new, so existing bookings are not all flagged the first time someone signs in.
// Used by the live API (lib/seen-server.js) and the demo (lib/demo.js), so both modes flag the same bookings.
export function newBookingIds(bookings, seenAt, viewed = []) {
  if (!seenAt) return [];
  const since = new Date(seenAt).getTime(), opened = new Set(viewed);
  return bookings.filter(b => b.createdAt && new Date(b.createdAt).getTime() > since && !opened.has(b.id)).map(b => b.id);
}
// The sidebar item that carries the dot: where each role's booking list lives.
export const NEW_NAV = { staff: '', 'front-desk': '', affiliate: 'referrals' };
// What the dot reads as, for screen readers and the banner.
export const newLabel = (count, affiliate) => affiliate
  ? (count === 1 ? 'Someone just booked through your link' : `${count} new bookings through your link`)
  : (count === 1 ? '1 new booking since you last checked' : `${count} new bookings since you last checked`);
// The browser tab title with the count in front, so staff notice from another tab.
export const titleWithCount = (title, count) => (count > 0 ? `(${count}) ` : '') + String(title).replace(/^\(\d+\) /, '');
// Bookings that arrived since the last check (in next, not in prev): these play the chime, once each.
export const arrivals = (prev, next) => { const before = new Set(prev); return next.filter(id => !before.has(id)); };
// Gift cards claimed without a booking ("Already have a prescription") are new to admin and front desk users until
// they press "Mark seen" on Gift cards (their own giftsSeenAt). Cards that come with a booking are covered by the booking.
export const newClaimIds = (claims, seenAt) => seenAt ? claims.filter(c => c.issuedAt && new Date(c.issuedAt) > new Date(seenAt)).map(c => c.id) : [];
export const claimLabel = count => count === 1 ? '1 new gift card claimed since you last checked' : `${count} new gift cards claimed since you last checked`;
