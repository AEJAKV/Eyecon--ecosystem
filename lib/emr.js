import { statuses } from './config.js';

// EMR (electronic medical record) integration: PLACEHOLDER. The EMR vendor is to be confirmed by the clinic, so no
// system is connected and every call returns null. When the vendor is chosen, write an adapter with the same two
// methods, return it from emrAdapter(), keep its credentials in server-only environment variables, and add
// `import 'server-only'` to the file that holds them.
//
//   getAppointment(reference) -> null, or what the EMR knows about that booking:
//     { status?: 'Booked' | 'Attended' | 'No-show' | 'Cancelled', doctorName?: string, start?: ISO string, duration?: minutes }
//     These override the website's own record on /my-booking, because the EMR is where the clinic changes them.
//   syncBooking(booking) -> null, or { externalId } once the EMR has the booking.
export const nullEmr = {
  async getAppointment(reference) { return null; },
  async syncBooking(booking) { return null; }
};
export function emrAdapter() { return nullEmr; }

// Lays what the EMR returned over the website's view of a booking. Only well-formed values are taken.
export function applyEmr(view, appointment) {
  if (!appointment) return view;
  const next = { ...view };
  if (statuses.includes(appointment.status)) next.status = appointment.status;
  if (typeof appointment.doctorName === 'string' && appointment.doctorName.trim()) next.doctorName = appointment.doctorName.trim().slice(0, 120);
  if (appointment.start && Number.isFinite(new Date(appointment.start).getTime())) next.start = new Date(appointment.start).toISOString();
  if (Number.isInteger(appointment.duration) && appointment.duration > 0 && appointment.duration <= 480) next.duration = appointment.duration;
  return next;
}
