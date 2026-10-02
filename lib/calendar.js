import { clinic, serviceName } from './config.js';
export function escapeICS(s) { return String(s).replaceAll('\\', '\\\\').replaceAll('\n', '\\n').replaceAll(',', '\\,').replaceAll(';', '\\;').replaceAll('\r', ''); }
const stamp = d => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
export function calendarFile(booking) {
  const lines = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Eyecon//Appointments//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH','BEGIN:VEVENT',`UID:${booking.id}@eyecon-appointments`,`DTSTAMP:${stamp(new Date())}`,`DTSTART:${stamp(booking.start)}`,`DTEND:${stamp(new Date(new Date(booking.start).getTime() + (booking.duration || 30) * 60000))}`,`SUMMARY:${escapeICS('Eyecon: ' + serviceName(booking.service))}`,`LOCATION:${escapeICS(clinic.address || 'Contact the clinic for location details')}`,'DESCRIPTION:Please bring your current glasses and insurance card.','END:VEVENT','END:VCALENDAR'];
  return lines.join('\r\n') + '\r\n';
}
export function googleCalendar(booking) {
  const end = new Date(new Date(booking.start).getTime() + (booking.duration || 30) * 60000);
  return 'https://calendar.google.com/calendar/render?' + new URLSearchParams({ action: 'TEMPLATE', text: 'Eyecon: ' + serviceName(booking.service), dates: stamp(booking.start) + '/' + stamp(end), location: clinic.address });
}
export function outlookCalendar(booking) { return 'https://outlook.live.com/calendar/0/deeplink/compose?' + new URLSearchParams({ subject: 'Eyecon: ' + serviceName(booking.service), startdt: booking.start, enddt: new Date(new Date(booking.start).getTime() + (booking.duration || 30) * 60000).toISOString(), location: clinic.address }); }
export function downloadFile(text, filename, type = 'text/plain') { const url = URL.createObjectURL(new Blob([text], { type })); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
