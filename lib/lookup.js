import { clinic, serviceName, doctorName } from './config.js';
import { giftNumber, REFERENCE_PATTERN } from './gift.js';
import { clean } from './validation.js';
import { applyEmr } from './emr.js';

// /my-booking: a patient finds their booking with its reference and the email they booked with. "Not found" and
// "wrong email" give the same answer, so the page cannot be used to learn whether someone has a booking.
export const LOOKUP_NOT_FOUND = 'We could not find a booking with that reference and email. Check both and try again, or call the clinic.';
export const LOOKUP_LIMIT_PER_HOUR = 10;
export function validateLookup(input) {
  const reference = clean(input?.reference, 40).toUpperCase().replace(/[\s-]/g, '');
  const email = clean(input?.email, 254).toLowerCase();
  if (!REFERENCE_PATTERN.test(reference)) throw new Error('Your booking reference is 8 letters and numbers, as shown in your confirmation.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Please enter the email address you booked with.');
  return { reference, email };
}
// Everything the lookup ever returns. Nothing else about the booking (contact details, insurance, documents,
// affiliate, notes) leaves the server. affiliate is { name, code } for the gift card number; emr is what the EMR
// adapter returned, which overrides status, doctor and time.
export function lookupView(b, { affiliate = null, fileComplete = false, emr = null } = {}) {
  return applyEmr({
    reference: b.reference,
    service: b.service,
    serviceName: serviceName(b.service),
    doctorName: doctorName(b.doctor) || '',
    start: new Date(b.start).toISOString(),
    duration: b.duration || 30,
    status: b.status,
    clinicAddress: clinic.address || '',
    giftCardNumber: b.giftCard?.serial ? giftNumber(affiliate, b.giftCard.serial) : null,
    fileComplete: !!fileComplete
  }, emr);
}
// A "Complete your file" link is offered only for an upcoming, active booking that still has no government ID.
export function needsDocumentsLink(view, now = new Date()) { return !view.fileComplete && view.status === 'Booked' && new Date(view.start) > now; }
