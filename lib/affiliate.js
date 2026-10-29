import { clinic } from './config.js';

// The affiliate workspace's restricted view. An affiliate sees, per referral, only the patient's name, the appointment
// date, its status, their own commission and its payout. Never contact details, service, insurance, documents,
// residency status, doctor, gift card, or any procedure amount (gross, discount, operation cost, net) or rate.
// The live API selects only these columns and then passes each row through restrictAffiliateRow; the demo does the
// same in affiliateRows(), so both modes give an affiliate exactly the same fields.
export const AFFILIATE_FIELDS = ['id', 'name', 'status', 'start', 'commission', 'payout', 'paidAt'];
export const AFFILIATE_COLUMNS = 'id,name,status,start,commission,payout,paid_at';

// Carries an affiliate's referral onto a link, so a booking started from a page they shared still counts for them.
// slug may be a query value (a string, an array if repeated, or missing); only a well-formed page name is passed on.
export function withAffiliate(href, slug) {
  const value = Array.isArray(slug) ? slug[0] : slug;
  if (typeof value !== 'string' || value.length > 70 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) return href;
  const [path, hash] = href.split('#');
  return path + (path.includes('?') ? '&' : '?') + 'affiliate=' + encodeURIComponent(value) + (hash === undefined ? '' : '#' + hash);
}

// A referral counts once it is completed (Attended). Until then its commission is shown blank.
export const completed = row => row.status === 'Attended';

// Builds the row from the allowed fields only, whatever else the source object carries. Accepts a database row
// (paid_at) or a demo booking (paidAt).
export function restrictAffiliateRow(row) {
  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    status: row.status,
    start: row.start,
    commission: Number(row.commission) || 0,
    payout: row.payout,
    paidAt: row.paidAt ?? row.paid_at ?? null
  };
}

const monthKey = iso => new Intl.DateTimeFormat('en-CA', { timeZone: clinic.timezone, year: 'numeric', month: '2-digit' }).format(new Date(iso));
// Overview and earnings figures. Upcoming bookings are a count only and never add to the completed figures.
export function affiliateStats(rows, now = new Date()) {
  const done = rows.filter(completed), sum = list => list.reduce((s, r) => s + (Number(r.commission) || 0), 0);
  const earned = sum(done), paid = sum(done.filter(r => r.payout === 'Paid'));
  return {
    completedThisMonth: done.filter(r => monthKey(r.start) === monthKey(now)).length,
    completedAllTime: done.length,
    upcoming: rows.filter(r => r.status === 'Booked' && new Date(r.start) > now).length,
    earned,
    paid,
    awaitingPayment: Math.round((earned - paid) * 100) / 100
  };
}

// The CSV an affiliate downloads: the same fields as the screen, with commission blank until completed.
export const AFFILIATE_CSV_FIELDS = ['name', 'appointment', 'status', 'yourCommission', 'payout', 'paidAt'];
export function affiliateCsvRows(rows) {
  return rows.map(r => ({ name: r.name, appointment: r.start, status: r.status, yourCommission: completed(r) ? (Number(r.commission) || 0).toFixed(2) : '', payout: completed(r) ? r.payout : '', paidAt: r.paidAt || '' }));
}

// The overview's "Referral journey": how many referrals are booked (upcoming or past, not yet completed), attended,
// and attended and paid. Counts only, from the restricted rows.
export function affiliateJourney(rows) {
  const booked = rows.filter(r => r.status === 'Booked').length, attended = rows.filter(completed).length;
  const paid = rows.filter(r => completed(r) && r.payout === 'Paid').length;
  return { booked, attended, paid, max: Math.max(booked, attended, paid, 1) };
}
// The share of earned commission already paid, 0–100 (0 when nothing is earned yet).
export const paidShare = st => st.earned > 0 ? Math.round(st.paid / st.earned * 100) : 0;
// The next upcoming booking, or null.
export function nextUpcoming(rows, now = new Date()) {
  return rows.filter(r => r.status === 'Booked' && new Date(r.start) > now).sort((a, b) => new Date(a.start) - new Date(b.start))[0] || null;
}
// The Referrals page filters: status chip ('All' or a status), name search and an optional clinic day (YYYY-MM-DD).
const dayOf = iso => new Intl.DateTimeFormat('en-CA', { timeZone: clinic.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
export function filterReferrals(rows, { status = 'All', query = '', date = '' } = {}) {
  const q = query.trim().toLowerCase();
  return rows.filter(r => (status === 'All' || r.status === status) && (!q || r.name.toLowerCase().includes(q)) && (!date || dayOf(r.start) === date));
}
