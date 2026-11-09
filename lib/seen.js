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
