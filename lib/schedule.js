// Optometrist profiles and schedules (migration 010). The rules here are shared by the staff API, the demo and the
// tests. Live slot generation happens in the database (planned_doctor_slots / generate_doctor_slots); planSlots and
// mergeGeneratedSlots below do exactly the same in JavaScript for the demo, so the two can be compared in tests.
import { services } from './config.js';
import { clean, validateSlug } from './validation.js';

export const SLOT_LENGTHS = [15, 30, 45, 60, 90];
// How far ahead bookable times are generated, in days.
export const SLOT_DAYS = 90;
// ISO weekdays: 1 is Monday, 7 is Sunday.
export const WEEKDAYS = [[1, 'Monday'], [2, 'Tuesday'], [3, 'Wednesday'], [4, 'Thursday'], [5, 'Friday'], [6, 'Saturday'], [7, 'Sunday']];
export const MAX_HOURS_ROWS = 28;
const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const minutesOf = hhmm => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const pad = n => String(n).padStart(2, '0');

// Does this optometrist offer this service? An empty or missing list means every service.
export function offersService(doctor, service) {
  if (!doctor) return false;
  if (!service || !Array.isArray(doctor.services) || !doctor.services.length) return true;
  return doctor.services.includes(service);
}
// Shown on the website and bookable online. Hidden optometrists keep their name for existing bookings.
export const isVisible = doctor => !!doctor && doctor.visible !== false;
export function websiteList(list) { return (list || []).filter(isVisible).sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.slug.localeCompare(b.slug)); }

// ---- Clinic time zone. Weekly hours, extra days and time off are entered in the clinic's local time. ----
function offsetMinutes(ms, timeZone) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(ms)).map(p => [p.type, p.value]));
  return (Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second) - ms) / 60000;
}
// 'YYYY-MM-DD' + 'HH:MM' in the clinic's time zone → ISO instant. Daylight saving changes are handled.
export function clinicTime(date, time, timeZone) {
  const [y, mo, d] = date.split('-').map(Number), [h, mi] = time.split(':').map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  let ms = guess - offsetMinutes(guess, timeZone) * 60000;
  ms = guess - offsetMinutes(ms, timeZone) * 60000;
  return new Date(ms).toISOString();
}
// The clinic's calendar date for an instant, as 'YYYY-MM-DD'.
export function clinicDate(instant, timeZone) {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(instant));
}
export function addDays(date, days) { const [y, m, d] = date.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1, d + days)); return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`; }
export function isoWeekday(date) { const [y, m, d] = date.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay() || 7; }

// ---- Validation (server, demo and staff form all use these) ----
export function doctorSlugFrom(first, last) {
  return ('dr-' + [first, last].join(' ')).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}
export function validateDoctorProfile(p) {
  const first = clean(p?.first, 60), last = clean(p?.last, 60);
  if (!first || !last) throw new Error('Enter the optometrist’s first and last name.');
  const slug = validateSlug(clean(p?.slug, 70) || doctorSlugFrom(first, last));
  const slotMinutes = Number(p?.slotMinutes ?? 30);
  if (!SLOT_LENGTHS.includes(slotMinutes)) throw new Error('Choose an appointment length of 15, 30, 45, 60 or 90 minutes.');
  const list = Array.isArray(p?.services) ? [...new Set(p.services)] : [];
  if (list.some(id => !services.some(s => s.id === id))) throw new Error('Choose services from the list.');
  return {
    slug, first, last, title: clean(p?.title, 20) || 'Dr.',
    line: clean(p?.line, 200), intro: clean(p?.intro, 1200), focus: clean(p?.focus, 200),
    languages: clean(p?.languages, 200), wears: clean(p?.wears, 200), alt: clean(p?.alt, 200),
    services: list.length && list.length < services.length ? list : null,
    visible: p?.visible !== false, slotMinutes
  };
}
// Weekly hours: rows of { weekday 1–7, start 'HH:MM', end 'HH:MM' } in clinic time. Several rows per day are allowed
// (a lunch break is a gap between two rows) but they may not overlap.
export function validateWeeklyHours(rows) {
  if (!Array.isArray(rows)) throw new Error('Add the weekly hours.');
  if (rows.length > MAX_HOURS_ROWS) throw new Error(`Use at most ${MAX_HOURS_ROWS} rows of hours.`);
  const hours = rows.map(r => {
    const weekday = Number(r?.weekday), start = String(r?.start || ''), end = String(r?.end || '');
    if (!WEEKDAYS.some(([n]) => n === weekday)) throw new Error('Choose a day for every row of hours.');
    if (!TIME.test(start) || !TIME.test(end)) throw new Error('Enter start and end times as HH:MM.');
    if (minutesOf(end) <= minutesOf(start)) throw new Error(`On ${WEEKDAYS[weekday - 1][1]}, the end time must be after the start time.`);
    return { weekday, start, end };
  }).sort((a, b) => a.weekday - b.weekday || minutesOf(a.start) - minutesOf(b.start));
  hours.forEach((h, i) => { const n = hours[i + 1]; if (n && n.weekday === h.weekday && minutesOf(n.start) < minutesOf(h.end)) throw new Error(`On ${WEEKDAYS[h.weekday - 1][1]}, two rows of hours overlap.`); });
  return hours;
}
// Time off: whole days (from date to date, inclusive) or part of a day (with times). Returned as ISO instants.
export function validateTimeOff(p, timeZone) {
  const from = String(p?.from || ''), to = String(p?.to || p?.from || ''), fromTime = String(p?.fromTime || ''), toTime = String(p?.toTime || '');
  if (!DATE.test(from) || !DATE.test(to)) throw new Error('Choose the dates of the time off.');
  if ((fromTime && !TIME.test(fromTime)) || (toTime && !TIME.test(toTime))) throw new Error('Enter times as HH:MM, or leave them empty for whole days.');
  const startsAt = clinicTime(from, fromTime || '00:00', timeZone);
  const endsAt = toTime ? clinicTime(to, toTime, timeZone) : clinicTime(addDays(to, 1), '00:00', timeZone);
  if (endsAt <= startsAt) throw new Error('The time off must end after it starts.');
  if (new Date(endsAt) - new Date(startsAt) > 400 * 86400000) throw new Error('Enter time off of at most about a year at a time.');
  return { startsAt, endsAt, reason: clean(p?.reason, 120) };
}
// A one-off extra day: date + start + end in clinic time.
export function validateExtraHours(p) {
  const day = String(p?.day || ''), start = String(p?.start || ''), end = String(p?.end || '');
  if (!DATE.test(day)) throw new Error('Choose the date of the extra hours.');
  if (!TIME.test(start) || !TIME.test(end)) throw new Error('Enter start and end times as HH:MM.');
  if (minutesOf(end) <= minutesOf(start)) throw new Error('The end time must be after the start time.');
  return { day, start, end };
}

// ---- Slots ----
const overlaps = (aStart, aEnd, bStart, bEnd) => aStart < bEnd && bStart < aEnd;
export function inTimeOff(slot, timeOff) {
  const s = new Date(slot.start).getTime(), e = s + (slot.duration || 30) * 60000;
  return (timeOff || []).some(t => t.doctor === slot.doctor && overlaps(s, e, new Date(t.startsAt).getTime(), new Date(t.endsAt).getTime()));
}
// The same as planned_doctor_slots in migration 010: for each visible optometrist, every slot of their length inside
// their weekly hours and extra days, from now to SLOT_DAYS ahead, minus anything touching their time off.
export function planSlots({ doctors, weeklyHours = [], extraHours = [], timeOff = [], timeZone, now = new Date(), days = SLOT_DAYS }) {
  const nowMs = new Date(now).getTime(), today = clinicDate(now, timeZone), seen = new Set(), out = [];
  const windows = [];
  for (let i = 0; i <= days; i++) {
    const date = addDays(today, i), weekday = isoWeekday(date);
    for (const d of doctors.filter(isVisible)) {
      for (const h of weeklyHours) if (h.doctor === d.slug && h.weekday === weekday) windows.push({ d, date, start: h.start, end: h.end });
      for (const x of extraHours) if (x.doctor === d.slug && x.day === date) windows.push({ d, date, start: x.start, end: x.end });
    }
  }
  for (const { d, date, start, end } of windows) {
    const minutes = d.slotMinutes || 30, from = new Date(clinicTime(date, start, timeZone)).getTime(), until = new Date(clinicTime(date, end, timeZone)).getTime();
    for (let s = from; s + minutes * 60000 <= until; s += minutes * 60000) {
      const slot = { doctor: d.slug, start: new Date(s).toISOString(), duration: minutes, generated: true };
      const key = slot.doctor + '|' + slot.start;
      if (s <= nowMs || seen.has(key) || inTimeOff(slot, timeOff)) continue;
      seen.add(key); out.push(slot);
    }
  }
  return out.sort((a, b) => a.start.localeCompare(b.start) || a.doctor.localeCompare(b.doctor));
}
// The same as generate_doctor_slots: keep past slots, slots staff added by hand, and any slot with a booking; replace
// the other future generated slots (for the given optometrist, or everyone) with the plan.
export function mergeGeneratedSlots(slots, planned, bookings, { doctor = null, now = new Date() } = {}) {
  const nowMs = new Date(now).getTime(), booked = new Set((bookings || []).map(b => b.doctor + '|' + b.start));
  const plannedKeys = new Map(planned.map(p => [p.doctor + '|' + p.start, p]));
  const kept = slots.filter(s => {
    if (!s.generated || new Date(s.start).getTime() <= nowMs || (doctor && s.doctor !== doctor) || booked.has(s.doctor + '|' + s.start)) return true;
    const p = plannedKeys.get(s.doctor + '|' + s.start);
    return !!p && p.duration === s.duration;
  });
  const have = new Set(kept.map(s => s.doctor + '|' + s.start));
  const added = planned.filter(p => (!doctor || p.doctor === doctor) && !have.has(p.doctor + '|' + p.start));
  return [...kept, ...added].sort((a, b) => a.start.localeCompare(b.start) || a.doctor.localeCompare(b.doctor));
}
// Booked appointments that new time off would cover: staff are told who to rebook. Nothing is cancelled.
export function bookingsInTimeOff(bookings, doctor, off) {
  const s = new Date(off.startsAt).getTime(), e = new Date(off.endsAt).getTime();
  return (bookings || []).filter(b => b.doctor === doctor && b.status === 'Booked' && overlaps(new Date(b.start).getTime(), new Date(b.start).getTime() + (b.duration || 30) * 60000, s, e))
    .map(b => ({ name: b.name, start: b.start }));
}
// ---- Database rows ↔ app objects ----
export function mapDoctorRow(r) {
  return { slug: r.slug, title: r.title, first: r.first_name, last: r.last_name, line: r.line, intro: r.intro, focus: r.focus, languages: r.languages, wears: r.wears, photo: r.photo || '/images/doctors/doctor-1.webp', alt: r.photo_alt || '', services: r.services?.length ? r.services : null, visible: r.visible, order: r.display_order, slotMinutes: r.slot_minutes };
}
export function doctorRow(d) {
  return { slug: d.slug, title: d.title, first_name: d.first, last_name: d.last, line: d.line, intro: d.intro, focus: d.focus, languages: d.languages, wears: d.wears, photo_alt: d.alt, services: d.services, visible: d.visible, slot_minutes: d.slotMinutes, updated_at: new Date().toISOString() };
}
// What the public website receives: no schedule internals.
export function publicDoctor(d) { const { slug, title, first, last, line, intro, focus, languages, wears, photo, alt, services: list, order } = d; return { slug, title, first, last, line, intro, focus, languages, wears, photo, alt, services: list, order, visible: true }; }
export const mapHoursRow = r => ({ id: r.id, doctor: r.doctor, weekday: r.weekday, start: String(r.start_time).slice(0, 5), end: String(r.end_time).slice(0, 5) });
export const mapTimeOffRow = r => ({ id: r.id, doctor: r.doctor, startsAt: r.starts_at, endsAt: r.ends_at, reason: r.reason || '' });
export const mapExtraRow = r => ({ id: r.id, doctor: r.doctor, day: r.day, start: String(r.start_time).slice(0, 5), end: String(r.end_time).slice(0, 5) });
