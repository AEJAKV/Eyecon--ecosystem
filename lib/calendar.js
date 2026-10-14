import { clinic, serviceName, doctorName } from './config.js';
export function escapeICS(s) { return String(s).replaceAll('\\', '\\\\').replaceAll('\n', '\\n').replaceAll(',', '\\,').replaceAll(';', '\\;').replaceAll('\r', ''); }
const stamp = d => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
// The event title names the optometrist the appointment is with, e.g. "Eyecon: Comprehensive eye exam with Dr. A B".
// booking.doctorName (from the lookup page, which may come from the EMR) wins over the doctor's slug.
const doctorOf = booking => booking.doctorName || doctorName(booking.doctor);
export function eventTitle(booking) { const doctor = doctorOf(booking); return 'Eyecon: ' + serviceName(booking.service) + (doctor ? ' with ' + doctor : ''); }
const details = booking => (doctorOf(booking) ? 'Your optometrist: ' + doctorOf(booking) + '. ' : '') + (booking.reference ? 'Booking reference: ' + booking.reference + '. ' : '') + 'Please bring your current glasses and insurance card.';
// The UID is the booking reference, so adding the event again from /my-booking updates it rather than duplicating it.
export function calendarFile(booking) {
  const lines = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Eyecon//Appointments//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH','BEGIN:VEVENT',`UID:${booking.reference || booking.id}@eyecon-appointments`,`DTSTAMP:${stamp(new Date())}`,`DTSTART:${stamp(booking.start)}`,`DTEND:${stamp(new Date(new Date(booking.start).getTime() + (booking.duration || 30) * 60000))}`,`SUMMARY:${escapeICS(eventTitle(booking))}`,`LOCATION:${escapeICS(clinic.address || 'Contact the clinic for location details')}`,`DESCRIPTION:${escapeICS(details(booking))}`,'END:VEVENT','END:VCALENDAR'];
  return lines.join('\r\n') + '\r\n';
}
export function googleCalendar(booking) {
  const end = new Date(new Date(booking.start).getTime() + (booking.duration || 30) * 60000);
  return 'https://calendar.google.com/calendar/render?' + new URLSearchParams({ action: 'TEMPLATE', text: eventTitle(booking), dates: stamp(booking.start) + '/' + stamp(end), details: details(booking), location: clinic.address });
}
export function outlookCalendar(booking) { return 'https://outlook.live.com/calendar/0/deeplink/compose?' + new URLSearchParams({ subject: eventTitle(booking), startdt: booking.start, enddt: new Date(new Date(booking.start).getTime() + (booking.duration || 30) * 60000).toISOString(), body: details(booking), location: clinic.address }); }
export function downloadFile(text, filename, type = 'text/plain') { const url = URL.createObjectURL(new Blob([text], { type })); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
