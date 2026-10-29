// Booking page helpers for the redesigned flow: grouping times by part of the day, how full a day looks, the live
// "Your appointment" summary, and the quick checks that tick a details field as it is filled in. Display only: the
// server still validates every booking (lib/validation.js).

// The hour of a time in the clinic's own time zone, so a 9 a.m. slot is "Morning" wherever the visitor is.
function clinicHour(iso, timeZone) {
  const h = new Intl.DateTimeFormat('en-CA', { timeZone, hour: 'numeric', hourCycle: 'h23' }).format(new Date(iso));
  return Number(h);
}
export function dayPart(iso, timeZone) {
  const h = clinicHour(iso, timeZone);
  return h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening';
}
const PART_ICONS = { Morning: 'sun', Afternoon: 'sunset', Evening: 'moon' };
// times: [[iso, doctors], ...] in start order. Returns only the parts of the day that have times, in day order.
export function groupByPart(times, timeZone) {
  const groups = [];
  for (const t of times) {
    const label = dayPart(t[0], timeZone);
    let g = groups.find(x => x.label === label);
    if (!g) { g = { label, icon: PART_ICONS[label], items: [] }; groups.push(g); }
    g.items.push(t);
  }
  const order = ['Morning', 'Afternoon', 'Evening'];
  return groups.sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label));
}
// One to three dots under a day: how many times are open that day, roughly.
export function loadDots(count) {
  if (!count) return 0;
  return count >= 8 ? 3 : count >= 4 ? 2 : 1;
}
export const nameOk = v => String(v || '').trim().length > 1;
export const phoneOk = v => String(v || '').replace(/\D/g, '').length >= 10;
export const emailOk = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim());
// The rows of the "Your appointment" card. Values not chosen yet read "Not chosen yet" and are drawn as pending.
export function summaryRows({ claim = false, serviceName = '', serviceIcon = 'eye', doctorLabel = '', when = '', email = '' }) {
  const row = (key, label, value, icon) => ({ key, label, value: value || 'Not chosen yet', icon, filled: !!value });
  if (claim) return [row('choice', 'You chose', 'Already have a prescription', 'gift'), { ...row('email', 'Gift card sent to', emailOk(email) ? email.trim() : '', 'mail'), value: emailOk(email) ? email.trim() : 'Your email address' }];
  return [row('service', 'Appointment', serviceName, serviceIcon), row('doctor', 'Optometrist', doctorLabel, 'user'), row('when', 'Date and time', when, 'calendar')];
}
// The one line above Continue on phones: what is chosen so far, or what to do next.
export function miniSummary({ claim = false, serviceName = '', when = '' }) {
  if (claim) return { title: 'Already have a prescription', sub: '$50 gift card by email' };
  return { title: serviceName || 'Nothing chosen yet', sub: when || (serviceName ? 'Pick a date and time next' : 'Choose the care you need') };
}
