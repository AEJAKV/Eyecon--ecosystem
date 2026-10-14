import { clinic, serviceName, doctorName } from './config.js';
import { completed } from './affiliate.js';

// Staff-only affiliate performance figures. These include procedure amounts, so they are only ever computed from the
// staff workspace data and never reach an affiliate (affiliates get lib/affiliate.js's restricted rows).
const sum = (list, fn) => Math.round(list.reduce((s, b) => s + (Number(fn(b)) || 0), 0) * 100) / 100;
const monthKey = iso => new Intl.DateTimeFormat('en-CA', { timeZone: clinic.timezone, year: 'numeric', month: '2-digit' }).format(new Date(iso));
export const dayKey = iso => new Intl.DateTimeFormat('en-CA', { timeZone: clinic.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
// What the patient was billed: gross minus discount, once the appointment has been completed with amounts.
export const billed = b => (b.grossAmount == null ? 0 : (Number(b.grossAmount) || 0) - (Number(b.discountAmount) || 0));

// One affiliate's figures. billed sums gross − discount over completed referrals; commission is split by payout.
export function affiliatePerformance(affiliate, bookings, now = new Date()) {
  const own = bookings.filter(b => b.affiliateId === affiliate.id), done = own.filter(completed);
  const thisMonth = done.filter(b => monthKey(b.start) === monthKey(now));
  return {
    affiliate,
    total: own.length,
    completed: done.length,
    upcoming: own.filter(b => b.status === 'Booked' && new Date(b.start) > now).length,
    billed: sum(done, billed),
    pending: sum(done.filter(b => b.payout !== 'Paid'), b => b.commission),
    paid: sum(done.filter(b => b.payout === 'Paid'), b => b.commission),
    commission: sum(done, b => b.commission),
    completedThisMonth: thisMonth.length,
    commissionThisMonth: sum(thisMonth, b => b.commission)
  };
}
// The Affiliates table, sorted by 'completed' or 'commission' (pending + paid), highest first unless dir is 'asc'.
// Ties fall back to name so the order is stable.
export function performanceTable(affiliates, bookings, { key = 'completed', dir = 'desc' } = {}, now = new Date()) {
  const rows = affiliates.map(a => affiliatePerformance(a, bookings, now)), sign = dir === 'asc' ? 1 : -1;
  return rows.sort((x, y) => sign * (x[key] - y[key]) || x.affiliate.name.localeCompare(y.affiliate.name));
}
// "Top affiliates this month" on the staff overview: most completed referrals this month, then most commission.
export function topAffiliates(affiliates, bookings, now = new Date(), limit = 3) {
  return affiliates.map(a => affiliatePerformance(a, bookings, now)).filter(p => p.completedThisMonth > 0)
    .sort((x, y) => y.completedThisMonth - x.completedThisMonth || y.commissionThisMonth - x.commissionThisMonth || x.affiliate.name.localeCompare(y.affiliate.name))
    .slice(0, limit);
}
// The appointment filters on an affiliate's page. from and to are YYYY-MM-DD in the clinic's timezone, inclusive.
export function filterAppointments(rows, { from = '', to = '', status = 'All' } = {}) {
  return rows.filter(b => (!from || dayKey(b.start) >= from) && (!to || dayKey(b.start) <= to) && (status === 'All' || b.status === status));
}
// The staff CSV for an affiliate's appointments: every staff field, amounts included.
export const STAFF_APPOINTMENT_FIELDS = ['reference', 'name', 'email', 'phone', 'start', 'doctor', 'service', 'source', 'status', 'gross', 'discount', 'billed', 'operationCost', 'net', 'rate', 'commission', 'payout', 'paidAt'];
const amount = v => (v == null ? '' : Number(v).toFixed(2));
export function staffAppointmentRows(rows) {
  return rows.map(b => ({
    reference: b.reference || '', name: b.name, email: b.email || '', phone: b.phone || '', start: b.start,
    doctor: doctorName(b.doctor) || b.doctor || '', service: serviceName(b.service), source: b.source, status: b.status,
    gross: amount(b.grossAmount), discount: amount(b.discountAmount), billed: b.grossAmount == null ? '' : billed(b).toFixed(2),
    operationCost: amount(b.operationCost), net: amount(b.netAmount), rate: b.commissionRate == null ? '' : String(b.commissionRate),
    commission: amount(b.commission), payout: b.payout, paidAt: b.paidAt || ''
  }));
}
