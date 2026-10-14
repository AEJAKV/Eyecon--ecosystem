import { services, statuses, doctors, serviceOptions, residencyStatuses, documentKinds, DOCUMENT_TYPES, DOCUMENT_MAX_BYTES, DOCUMENT_MAX_FILES } from './config.js';
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
  const doctor = validateDoctor(input.doctor);
  // Optional. Only an option the chosen service offers is kept (for example a skin tightening technology).
  const serviceOption = serviceOptions[input.service]?.some(o => o.slug === input.serviceOption) ? input.serviceOption : null;
  const source = manual ? (['Phone', 'Walk-in', 'Direct'].includes(input.source) ? input.source : 'Phone') : (input.affiliateId ? 'Affiliate' : 'Direct');
  return { name, email, phone, service: input.service, start: date.toISOString(), firstVisit: input.firstVisit, insurance: clean(input.insurance, 120), policy: clean(input.policy, 120), brands: clean(input.brands, 300), smsConsent: input.smsConsent === true, affiliateId: clean(input.affiliateId, 60) || null, doctor, serviceOption, source };
}
// Every appointment belongs to one optometrist: the slug of a doctor in lib/config.js.
export function validateDoctor(slug) { if (typeof slug !== 'string' || !doctors.some(d => d.slug === slug)) throw new Error('Please choose an optometrist.'); return slug; }
// The "Complete your file" form: a residency status from the list, exactly one government ID, and up to
// DOCUMENT_MAX_FILES files in total, each a PDF, JPG or PNG of at most DOCUMENT_MAX_BYTES with a known kind.
// files are descriptions only ({ name, size, type, kind }); the bytes are checked separately by fileSignatureOk.
export function validateDocuments(input) {
  const residencyStatus = residencyStatuses.includes(input?.residencyStatus) ? input.residencyStatus : null;
  if (!residencyStatus) throw new Error('Please choose your residency status.');
  const files = Array.isArray(input?.files) ? input.files : [];
  if (files.length > DOCUMENT_MAX_FILES) throw new Error(`Please upload at most ${DOCUMENT_MAX_FILES} files in total.`);
  const ids = files.filter(f => f?.kind === 'government-id').length;
  if (ids === 0) throw new Error('Please add a valid government ID.');
  if (ids > 1) throw new Error('Please add only one government ID.');
  const described = files.map(f => {
    const name = clean(f?.name, 200) || 'document';
    if (!documentKinds.some(k => k.id === f?.kind)) throw new Error(`Choose what “${name}” is.`);
    if (!DOCUMENT_TYPES[f?.type]) throw new Error(`“${name}” must be a PDF, JPG or PNG file.`);
    if (!Number.isInteger(f?.size) || f.size <= 0) throw new Error(`“${name}” is empty.`);
    if (f.size > DOCUMENT_MAX_BYTES) throw new Error(`“${name}” is larger than ${DOCUMENT_MAX_BYTES / 1048576} MB.`);
    return { name, size: f.size, type: f.type, kind: f.kind };
  });
  return { residencyStatus, files: described };
}
// Does the file start with the signature its type claims? PDF: "%PDF-". JPEG: FF D8 FF. PNG: the 8-byte PNG signature.
export function fileSignatureOk(type, bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  const starts = sig => sig.every((x, i) => b[i] === x);
  if (type === 'application/pdf') return starts([0x25, 0x50, 0x44, 0x46, 0x2d]);
  if (type === 'image/jpeg') return starts([0xff, 0xd8, 0xff]);
  if (type === 'image/png') return starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return false;
}
// "File complete" once a government ID has been uploaded; "Missing ID" until then.
export function fileComplete(booking) { return !!booking?.documents?.some(d => d.kind === 'government-id'); }
export function validateStatus(status) { if (!statuses.includes(status)) throw new Error('Invalid booking status.'); return status; }
export function validateSlug(slug) { if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 70) throw new Error('Use lowercase letters, numbers and single hyphens for the page name.'); return slug; }
// An affiliate's optional gift card code: blank, or exactly three letters (stored in capitals).
export function validateGiftCode(code) { const value = clean(code, 10).toUpperCase(); if (!value) return null; if (!/^[A-Z]{3}$/.test(value)) throw new Error('The gift card code must be exactly three letters.'); return value; }
export function safePhoto(url) { return typeof url === 'string' && (url.startsWith('/images/') || /^https:\/\//.test(url)) ? url : '/images/affiliate.webp'; }
// A slot is taken when its optometrist already has an active booking overlapping it. Other optometrists' bookings
// never block it. A record without a doctor (which should not exist) is treated as blocking, to be safe.
export function slotTaken(slot, bookings) { const start=new Date(slot.start).getTime(),end=start+(slot.duration||30)*60000;return bookings.some(b=>b.status!=='Cancelled'&&(!slot.doctor||!b.doctor||b.doctor===slot.doctor)&&start<new Date(b.start).getTime()+(b.duration||30)*60000&&end>new Date(b.start).getTime()); }
export function csv(rows, fields) { const cell = x => { let v=String(x ?? '');if(/^\s*[=+@-]/.test(v))v="'"+v;return '"'+v.replaceAll('"','""')+'"'; }; return [fields.map(cell).join(','), ...rows.map(r => fields.map(f => cell(r[f])).join(','))].join('\r\n'); }
