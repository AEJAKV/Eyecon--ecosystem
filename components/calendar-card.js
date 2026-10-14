'use client';
import { useEffect, useState } from 'react';
import { calendarFile, googleCalendar, outlookCalendar, downloadFile } from '@/lib/calendar';
import { Icon } from './ui';

const NAMES = { google: 'Google Calendar', apple: 'Apple Calendar', outlook: 'Outlook' };
// Pick the calendar that this device most likely uses for the one-tap button.
function preferredCalendar() {
  if (typeof navigator === 'undefined') return 'google';
  const ua = navigator.userAgent;
  if (/iPhone|iPad|Macintosh/.test(ua)) return 'apple';
  if (/Windows/.test(ua)) return 'outlook';
  return 'google';
}
// "Add it to your calendar", used on the confirmation step and on /my-booking.
export default function CalendarCard({ booking, text = 'One tap, so you won’t miss it. Your confirmation email has the invite too.' }) {
  const [calendar, setCalendar] = useState('google'), [added, setAdded] = useState('');
  useEffect(() => { setCalendar(preferredCalendar()); }, []);
  function addTo(kind) {
    if (kind === 'apple') downloadFile(calendarFile(booking), 'eyecon-appointment.ics', 'text/calendar');
    else window.open(kind === 'google' ? googleCalendar(booking) : outlookCalendar(booking), '_blank', 'noopener,noreferrer');
    setAdded(kind);
  }
  return <div className="calendar-card">
    <h3>Add it to your calendar</h3>
    <p>{text}</p>
    <div className="calendar-actions">
      <button type="button" className="button primary" onClick={() => addTo(calendar)}><Icon name="calendar" size={20} />Add to {NAMES[calendar]}</button>
      {['google', 'apple', 'outlook'].filter(k => k !== calendar).map(k => <button type="button" key={k} className="button" onClick={() => addTo(k)}>{NAMES[k]}</button>)}
    </div>
    {added && <p className="calendar-added" role="status"><Icon name="check" size={18} />Opened in {NAMES[added]}. Save it there to finish.</p>}
  </div>;
}
