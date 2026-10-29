'use client';
import { useMemo } from 'react';
import { clinic, serviceName, doctorName } from '@/lib/config';
import { deskDay, giftSummary } from '@/lib/front-desk';
import { giftCardRows } from '@/lib/gift';
import { fileComplete } from '@/lib/validation';
import { Icon, Empty } from './ui';
import { GiftBadge } from './gift-status';
import { useCountUp, StatusPill, initials } from './affiliate-view';

// The front desk (/desk) Bookings and Gift cards panels. Only frontDeskView's fields reach here: no money.

function DeskStat({ icon, tone, label, value, note, bar, delay }) {
  const n = Math.round(useCountUp(value, 900));
  return <article className="stat-card rise" style={{ animationDelay: delay + 's' }}>
    <div className="stat-top"><span className={'stat-icon ' + tone}><Icon name={icon} size={20} /></span></div>
    <p>{label}</p><strong>{n}</strong>
    {bar != null && <div className="meter" aria-hidden="true"><span style={{ width: bar + '%' }} /></div>}
    <small>{note}</small>
  </article>;
}
const timeParts = iso => { const t = new Intl.DateTimeFormat('en-CA', { timeZone: clinic.timezone, hour: 'numeric', minute: '2-digit' }).format(new Date(iso)); const i = t.indexOf(' '); return i > 0 ? [t.slice(0, i), t.slice(i + 1)] : [t, '']; };
const longDay = iso => new Intl.DateTimeFormat('en-CA', { timeZone: clinic.timezone, weekday: 'long', month: 'long', day: 'numeric' }).format(new Date(iso));

// Today at a glance, then today's schedule with one-click check-in. onStatus(booking, status) changes attendance.
export function DeskToday({ bookings, busy, onStatus, onDetails }) {
  const day = useMemo(() => deskDay(bookings, clinic.timezone), [bookings]);
  const share = day.total ? Math.round(day.checkedIn / day.total * 100) : 0;
  return <>
    <div className="stats stat-cards desk-stats">
      <DeskStat icon="calendar" tone="ink" label="Today’s appointments" value={day.total} note={day.total ? day.noShow + ' no-show' + (day.noShow === 1 ? '' : 's') : 'Nothing booked today'} delay={0.04} />
      <DeskStat icon="checkCircle" tone="green" label="Checked in" value={day.checkedIn} bar={share} note={day.total ? share + '% of today' : 'Check patients in as they arrive'} delay={0.1} />
      <DeskStat icon="clock" tone="gold" label="Still to arrive" value={day.toArrive} note="Booked for today" delay={0.16} />
      <DeskStat icon="receipt" tone={day.missingId ? 'red' : 'green'} label="Files missing ID" value={day.missingId} note={day.giftsOpen + ' upcoming gift card' + (day.giftsOpen === 1 ? '' : 's') + ' to redeem'} delay={0.22} />
    </div>
    <section className="panel-card list-card schedule rise" style={{ animationDelay: '.28s' }} aria-labelledby="schedule-title">
      <div className="card-head"><h2 id="schedule-title">{day.isToday ? 'Today’s schedule' : 'Next appointments'}</h2><span className="quiet">{day.isToday ? longDay(new Date()) : day.nextDate ? longDay(day.nextDate) : ''} · {clinic.timezoneLabel}</span></div>
      {day.list.length ? <ol className="ref-list">{day.list.map(b => { const [time, half] = timeParts(b.start), open = day.isToday && b.status === 'Booked'; return <li key={b.id} className={'ref-row schedule-row ' + b.status.toLowerCase()}>
        <span className="slot-time"><strong>{time}</strong><small>{half}</small></span>
        <span className="avatar" aria-hidden="true">{initials(b.name)}</span>
        <span className="ref-row-main"><strong>{b.name}</strong><small>{serviceName(b.service)}{b.doctor && <> · {doctorName(b.doctor) || b.doctor}</>}</small>
          <span className="row-badges"><span className={'badge file-badge ' + (fileComplete(b) ? 'attended' : 'no-show')}>{fileComplete(b) ? 'File complete' : 'Missing ID'}</span>{b.giftCard && <GiftBadge card={b.giftCard} />}</span></span>
        <StatusPill status={b.status} />
        <span className="row-actions">
          {open && <><button type="button" className="mini-button" disabled={busy} onClick={() => onStatus(b, 'Attended')}><Icon name="check" size={16} />Check in<span className="sr-only"> {b.name}</span></button><button type="button" className="mini-button quiet-button" disabled={busy} onClick={() => onStatus(b, 'No-show')}>No-show<span className="sr-only"> for {b.name}</span></button></>}
          {day.isToday && (b.status === 'Attended' || b.status === 'No-show') && <button type="button" className="text-link" disabled={busy} onClick={() => onStatus(b, 'Booked')}>Undo<span className="sr-only"> {b.status} for {b.name}</span></button>}
          <button type="button" className="text-link" onClick={() => onDetails(b)}>Details<span className="sr-only"> for {b.name}</span></button>
        </span>
      </li>; })}</ol> : <Empty text="No upcoming appointments." />}
    </section>
  </>;
}

// Gift cards: how many cards are still to redeem, redeemed and expired.
export function GiftSummary({ data }) {
  const s = giftSummary(giftCardRows(data));
  return <div className="stats stat-cards desk-stats">
    <DeskStat icon="gift" tone="gold" label="Not redeemed" value={s.open} note="Ready to use at the clinic" delay={0.04} />
    <DeskStat icon="checkCircle" tone="green" label="Redeemed" value={s.redeemed} bar={s.total ? Math.round(s.redeemed / s.total * 100) : 0} note={'Of ' + s.total + ' card' + (s.total === 1 ? '' : 's') + ' issued'} delay={0.1} />
    <DeskStat icon="clock" tone="ink" label="Expired" value={s.expired} note="Past their valid-until date" delay={0.16} />
    <DeskStat icon="qr" tone="gold" label="Cards issued" value={s.total} note="Booking and prescription cards" delay={0.22} />
  </div>;
}
