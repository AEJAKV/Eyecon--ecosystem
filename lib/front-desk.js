import { fileComplete } from './validation.js';
import { giftState } from './gift.js';
// The front desk workspace (/desk): clinic staff who run Bookings, Gift cards and Leads only. They see patient
// contact details, insurance and documents, so they can check patients in, but never money: no commission, payout,
// rate or procedure amount (gross, discount, operation cost, net), no pricing, payouts, templates or delivery log.
// The live API passes its data through frontDeskView before sending it; the demo workspace does the same, so both
// modes show the front desk exactly the same fields.
export const FRONT_DESK_ROLE = 'front-desk';
export const CLINIC_ROLES = ['staff', FRONT_DESK_ROLE];
export const isClinic = user => CLINIC_ROLES.includes(user?.role);
// Where each role's workspace lives.
export const workspacePath = role => role === 'staff' ? '/admin' : role === FRONT_DESK_ROLE ? '/desk' : '/affiliate';
// The workspace actions the front desk may use. Everything else (pricing, payouts, completing a commission,
// affiliates, templates, doctors, team, photos, affiliate profiles) is staff admin only.
export const FRONT_DESK_ACTIONS = ['status', 'gift-redeem', 'slot', 'booking', 'document-url'];
export const canAct = (role, action) => role === 'staff' || (role === FRONT_DESK_ROLE && FRONT_DESK_ACTIONS.includes(action));
// Booking fields the front desk never receives.
export const MONEY_FIELDS = ['commission', 'payout', 'paidAt', 'grossAmount', 'discountAmount', 'operationCost', 'netAmount', 'commissionRate'];
export function deskBooking(b) { const row = { ...b }; for (const f of MONEY_FIELDS) delete row[f]; return row; }
// Affiliates as the front desk sees them: enough to credit a manual booking and to read gift card numbers. Never their
// email, commission rate or terms.
export const deskAffiliate = a => ({ id: a.id, name: a.name, slug: a.slug, code: a.code || null, active: a.active });
export function frontDeskView(data) {
  return {
    user: { role: FRONT_DESK_ROLE },
    affiliates: (data.affiliates || []).map(deskAffiliate),
    bookings: (data.bookings || []).map(deskBooking),
    giftClaims: data.giftClaims || [],
    slots: data.slots || [],
    doctors: data.doctors || [],
    templates: []
  };
}
// Staff admin > Team: invite a front desk member by name and email.
export function validateTeamMember(p) {
  const name = typeof p?.name === 'string' ? p.name.trim().slice(0, 120) : '', email = typeof p?.email === 'string' ? p.email.trim().toLowerCase().slice(0, 254) : '';
  if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a name and valid email.');
  return { name, email };
}

// The front desk's "Today" panel: today's appointments in clinic time (cancelled ones left out), sorted by time, with
// how many have checked in, are still to arrive or did not show. When nothing is booked today, list is the next day
// that has appointments (isToday false). missingId and giftsOpen count upcoming booked visits whose file still needs
// government ID, and whose gift card is still to be redeemed.
export function deskDay(bookings, timeZone, now = new Date()) {
  const key = d => new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(d));
  const byTime = (a, b) => new Date(a.start) - new Date(b.start), today = key(now);
  const live = bookings.filter(b => b.status !== 'Cancelled'), todays = live.filter(b => key(b.start) === today).sort(byTime);
  const next = todays.length ? null : live.filter(b => new Date(b.start) > now).sort(byTime)[0];
  const upcoming = live.filter(b => b.status === 'Booked' && new Date(b.start) > now);
  return {
    isToday: todays.length > 0,
    list: todays.length ? todays : next ? live.filter(b => key(b.start) === key(next.start)).sort(byTime) : [],
    nextDate: next?.start || null,
    total: todays.length,
    checkedIn: todays.filter(b => b.status === 'Attended').length,
    toArrive: todays.filter(b => b.status === 'Booked').length,
    noShow: todays.filter(b => b.status === 'No-show').length,
    missingId: upcoming.filter(b => !fileComplete(b)).length,
    giftsOpen: upcoming.filter(b => b.giftCard && giftState(b.giftCard, now) === 'Not redeemed').length
  };
}
// Gift cards page summary: how many cards are in each state (rows from giftCardRows in lib/gift.js).
export function giftSummary(rows) {
  const count = state => rows.filter(r => r.state === state).length;
  return { total: rows.length, open: count('Not redeemed'), redeemed: count('Redeemed'), expired: count('Expired') };
}
