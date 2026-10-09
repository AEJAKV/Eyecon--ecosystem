import { services, statuses, doctors } from './config.js';
export function clean(value, max = 250) { return typeof value === 'string' ? value.trim().slice(0, max) : ''; }
export function validateBooking(input, manual = false) {
  const name = clean(input.name, 120), email = clean(input.email, 254).toLowerCase(), phone = clean(input.phone, 32);
  if (name.length < 2) throw new Error('Please enter your full name.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Please enter a valid email address.');
  if (!/^\+?[\d\s().-]{7,25}$/.test(phone)) throw new Error('Please enter a valid mobile number.');
  if (input.smsConsent && !/^\+[1-9]\d{7,14}$/.test(phone)) throw new Error('For SMS reminders, use an international number such as +14165550123.');
  if (!services.some(s => s.id === input.service)) throw new Error('Please choose an appointment type.');
  const date = new Date(input.start);
  if (!Number.isFinite(date.getTime()) || date <= new Date()) throw new Error('Choose an available future appointment.');
  if (typeof input.firstVisit !== 'boolean') throw new Error('Please tell us whether this is your first visit.');
  // Optional. Only a known doctor's slug is kept; anything else is dropped rather than saved.
  const preferredDoctor = doctors.some(d => d.slug === input.preferredDoctor) ? input.preferredDoctor : null;
  const source = manual ? (['Phone', 'Walk-in', 'Direct'].includes(input.source) ? input.source : 'Phone') : (input.affiliateId ? 'Affiliate' : 'Direct');
  return { name, email, phone, service: input.service, start: date.toISOString(), firstVisit: input.firstVisit, insurance: clean(input.insurance, 120), policy: clean(input.policy, 120), brands: clean(input.brands, 300), smsConsent: input.smsConsent === true, affiliateId: clean(input.affiliateId, 60) || null, preferredDoctor, source };
}
export function validateStatus(status) { if (!statuses.includes(status)) throw new Error('Invalid booking status.'); return status; }
export function validateSlug(slug) { if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 70) throw new Error('Use lowercase letters, numbers and single hyphens for the page name.'); return slug; }
// An affiliate's optional gift card code: blank, or exactly three letters (stored in capitals).
export function validateGiftCode(code) { const value = clean(code, 10).toUpperCase(); if (!value) return null; if (!/^[A-Z]{3}$/.test(value)) throw new Error('The gift card code must be exactly three letters.'); return value; }
export function safePhoto(url) { return typeof url === 'string' && (url.startsWith('/images/') || /^https:\/\//.test(url)) ? url : '/images/affiliate.webp'; }
export function slotTaken(slot, bookings) { const start=new Date(slot.start).getTime(),end=start+(slot.duration||30)*60000;return bookings.some(b=>b.status!=='Cancelled'&&start<new Date(b.start).getTime()+(b.duration||30)*60000&&end>new Date(b.start).getTime()); }
export function csv(rows, fields) { const cell = x => { let v=String(x ?? '');if(/^\s*[=+@-]/.test(v))v="'"+v;return '"'+v.replaceAll('"','""')+'"'; }; return [fields.map(cell).join(','), ...rows.map(r => fields.map(f => cell(r[f])).join(','))].join('\r\n'); }
