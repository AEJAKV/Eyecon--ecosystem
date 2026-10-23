'use client';
import { useMemo, useState } from 'react';
import { Button, Field, Notice } from './ui';
import { clinic, services, formatDate } from '@/lib/config';
import { slotTaken } from '@/lib/validation';
import { WEEKDAYS, SLOT_LENGTHS, SLOT_DAYS, validateWeeklyHours, validateTimeOff, bookingsInTimeOff, inTimeOff, clinicDate, doctorSlugFrom } from '@/lib/schedule';

// Staff admin > Doctors: the optometrists the website shows and their schedules (migration 010). Each change goes
// through onAction (the /api/doctors route, or the demo), which regenerates that optometrist's bookable times.
// run(fn, message) is the workspace's wrapper: it shows the busy state, the success message or the error.
const short = n => WEEKDAYS[n - 1][1].slice(0, 3);
const fullName = d => `${d.title} ${d.first} ${d.last}`;
let keySeq = 0;
const key = () => 'row-' + (++keySeq);

export default function DoctorsAdmin({ data, doctors, busy, run, onAction, onPhoto }) {
  const [editing, setEditing] = useState('');
  const list = useMemo(() => [...doctors].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.slug.localeCompare(b.slug)), [doctors]);
  const soon = Date.now() + 14 * 86400000;
  const openTimes = slug => (data.slots || []).filter(s => s.doctor === slug && new Date(s.start) > new Date() && new Date(s.start) < soon && !slotTaken(s, data.bookings || []) && !inTimeOff(s, data.timeOff)).length;
  async function move(slug, by) {
    const order = list.map(d => d.slug), i = order.indexOf(slug), j = i + by;
    if (j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    await run(() => onAction('doctor-order', { slugs: order }), 'Order saved. The website shows optometrists in this order.');
  }
  return <div className="doctors-admin">
    <div className="section-heading">
      <p className="muted">The website’s “The people behind your exam” section and the booking form both use this list. Times open for booking come from each optometrist’s weekly hours, minus time off, plus extra days, always {SLOT_DAYS} days ahead. Booked appointments are never removed by a schedule change.</p>
      <Button disabled={busy} onClick={() => setEditing(editing === 'new' ? '' : 'new')}>{editing === 'new' ? 'Close' : 'Add optometrist'}</Button>
    </div>
    {editing === 'new' && <section className="panel doctor-editor" aria-labelledby="new-doctor-title">
      <h2 id="new-doctor-title">New optometrist</h2>
      <ProfileForm isNew busy={busy} onSave={async p => { const r = await run(() => onAction('doctor', { ...p, isNew: true }), `${p.title || 'Dr.'} ${p.first} ${p.last} added. Now set their weekly hours.`); if (r !== false) setEditing(r?.slug || doctorSlugFrom(p.first, p.last)); }} />
    </section>}
    <ul className="doctor-admin-list">
      {list.map((d, i) => {
        const hours = (data.weeklyHours || []).filter(h => h.doctor === d.slug), open = editing === d.slug, count = openTimes(d.slug);
        return <li key={d.slug} className="panel doctor-admin-card">
          <div className="doctor-admin-head">
            <img src={d.photo} alt="" width="56" height="70" />
            <div>
              <h2>{fullName(d)} <span className={'badge ' + (d.visible === false ? 'no-show' : 'attended')}>{d.visible === false ? 'Hidden' : 'Shown'}</span></h2>
              <p className="quiet">{summary(hours)} · {d.slotMinutes || 30}-minute appointments · {d.services?.length ? d.services.map(id => services.find(s => s.id === id)?.name).join(', ') : 'All services'}</p>
              <p className="quiet">{d.visible === false ? 'Not bookable online.' : `${count} open time${count === 1 ? '' : 's'} in the next 14 days.`}</p>
            </div>
            <div className="toolbar">
              <button type="button" className="text-link" disabled={busy || i === 0} onClick={() => move(d.slug, -1)}>Move up<span className="sr-only"> {fullName(d)}</span></button>
              <button type="button" className="text-link" disabled={busy || i === list.length - 1} onClick={() => move(d.slug, 1)}>Move down<span className="sr-only"> {fullName(d)}</span></button>
              <Button secondary disabled={busy} aria-expanded={open} onClick={() => setEditing(open ? '' : d.slug)}>{open ? 'Close' : 'Edit'}<span className="sr-only"> {fullName(d)}</span></Button>
            </div>
          </div>
          {open && <div className="doctor-editor">
            <ProfileForm key={'p' + d.slug} doctor={d} busy={busy} onSave={p => run(() => onAction('doctor', { ...d, ...p }), 'Profile saved.')} onPhoto={f => run(() => onPhoto(f, d.slug), 'Photo updated.')} />
            <HoursForm key={'h' + d.slug + hours.length} doctor={d} hours={hours} busy={busy} onSave={p => run(() => onAction('doctor-hours', p), 'Hours saved. Open times have been updated.')} />
            <TimeOff doctor={d} entries={(data.timeOff || []).filter(t => t.doctor === d.slug)} bookings={data.bookings || []} busy={busy} run={run} onAction={onAction} />
            <ExtraDays doctor={d} entries={(data.extraHours || []).filter(x => x.doctor === d.slug && x.day >= clinicDate(new Date(), clinic.timezone))} busy={busy} run={run} onAction={onAction} />
          </div>}
        </li>;
      })}
    </ul>
  </div>;
}

// "Mon 09:00–12:00, 13:00–17:00 · Tue …", or a prompt when there are no hours yet.
function summary(hours) {
  if (!hours.length) return 'No weekly hours yet';
  return WEEKDAYS.map(([n]) => { const day = hours.filter(h => h.weekday === n); return day.length ? short(n) + ' ' + day.map(h => h.start + '–' + h.end).join(', ') : ''; }).filter(Boolean).join(' · ');
}

function ProfileForm({ doctor = {}, isNew = false, busy, onSave, onPhoto }) {
  const [chosen, setChosen] = useState(doctor.services?.length ? doctor.services : services.map(s => s.id));
  const [error, setError] = useState('');
  const id = (isNew ? 'new' : doctor.slug) + '-';
  function submit(e) {
    e.preventDefault(); setError('');
    const f = new FormData(e.currentTarget), v = k => String(f.get(k) || '');
    if (!chosen.length) { setError('Choose at least one service.'); return; }
    onSave({ title: v('title'), first: v('first'), last: v('last'), line: v('line'), intro: v('intro'), focus: v('focus'), languages: v('languages'), wears: v('wears'), alt: v('alt'), services: chosen, visible: f.get('visible') === 'on' });
  }
  return <form className="stack" onSubmit={submit} aria-label={isNew ? 'New optometrist profile' : 'Profile'}>
    {!isNew && <h3>Profile</h3>}
    {!isNew && <div className="profile-image">
      <img src={doctor.photo} width="100" height="125" alt="" />
      <label>Portrait<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e => { const file = e.target.files?.[0]; if (!file) return; if (file.size > 2097152) setError('Use an image smaller than 2 MB.'); else onPhoto(file); e.target.value = ''; }} /><small>JPG, PNG or WebP, at most 2 MB. A tall (4:5) photograph fits the website’s cards best.</small></label>
    </div>}
    <Notice error>{error}</Notice>
    <div className="form-grid">
      <Field label="Title" id={id + 'title'} name="title" defaultValue={doctor.title || 'Dr.'} maxLength={20} />
      <span />
      <Field label="First name" id={id + 'first'} name="first" defaultValue={doctor.first || ''} required maxLength={60} />
      <Field label="Last name" id={id + 'last'} name="last" defaultValue={doctor.last || ''} required maxLength={60} />
    </div>
    <Field label="Short line (on the card)" id={id + 'line'} name="line" defaultValue={doctor.line || ''} maxLength={200} />
    <Field label="Introduction" id={id + 'intro'}><textarea id={id + 'intro'} name="intro" defaultValue={doctor.intro || ''} rows={4} maxLength={1200} /></Field>
    <div className="form-grid">
      <Field label="Areas of focus" id={id + 'focus'} name="focus" defaultValue={doctor.focus || ''} maxLength={200} />
      <Field label="Languages spoken" id={id + 'languages'} name="languages" defaultValue={doctor.languages || ''} maxLength={200} />
      <Field label="The frames they wear" id={id + 'wears'} name="wears" defaultValue={doctor.wears || ''} maxLength={200} />
      {!isNew && <Field label="Photo description (optional)" id={id + 'alt'} name="alt" defaultValue={doctor.alt || ''} maxLength={200} hint="Leave empty for a real portrait; the name is used." />}
    </div>
    <fieldset className="choice-field">
      <legend>Services they perform</legend>
      <div className="doctor-services">{services.map(s => <label key={s.id} className="checkbox-label"><input type="checkbox" checked={chosen.includes(s.id)} onChange={e => setChosen(c => e.target.checked ? [...c, s.id] : c.filter(x => x !== s.id))} />{s.name}</label>)}</div>
      <p className="quiet">Patients only see this optometrist when they book one of these services.</p>
    </fieldset>
    <label className="checkbox-label"><input type="checkbox" name="visible" defaultChecked={doctor.visible !== false} /><span>Show on the website and allow online booking<small>Hiding keeps their existing appointments and their name on past bookings. Optometrists are never deleted.</small></span></label>
    <Button disabled={busy}>{isNew ? 'Add optometrist' : 'Save profile'}</Button>
  </form>;
}

function HoursForm({ doctor, hours, busy, onSave }) {
  const [rows, setRows] = useState(() => hours.map(h => ({ key: key(), weekday: h.weekday, start: h.start, end: h.end })));
  const [minutes, setMinutes] = useState(doctor.slotMinutes || 30);
  const [error, setError] = useState('');
  const set = (k, field, value) => setRows(r => r.map(x => x.key === k ? { ...x, [field]: value } : x));
  function submit(e) {
    e.preventDefault(); setError('');
    try { const checked = validateWeeklyHours(rows); onSave({ doctor: doctor.slug, slotMinutes: minutes, hours: checked }); }
    catch (err) { setError(err.message); }
  }
  return <form className="stack" onSubmit={submit} aria-label="Weekly hours">
    <h3>Weekly hours</h3>
    <p className="quiet">In clinic time. Add two rows on a day for a break between them (for example 09:00–12:00 and 13:00–17:00).</p>
    <Notice error>{error}</Notice>
    <Field label="Appointment length" id={doctor.slug + '-minutes'}><select id={doctor.slug + '-minutes'} value={minutes} onChange={e => setMinutes(Number(e.target.value))}>{SLOT_LENGTHS.map(n => <option key={n} value={n}>{n} minutes</option>)}</select></Field>
    <div className="hours-week">
      {WEEKDAYS.map(([n, label]) => {
        const day = rows.filter(r => r.weekday === n);
        return <div className="hours-day" key={n} role="group" aria-label={label}>
          <strong>{label}</strong>
          <div className="hours-ranges">
            {day.length ? day.map(r => <div className="hours-range" key={r.key}>
              <label className="sr-only" htmlFor={r.key + '-s'}>{label} start</label><input id={r.key + '-s'} type="time" step="300" value={r.start} required onChange={e => set(r.key, 'start', e.target.value)} />
              <span aria-hidden="true">to</span>
              <label className="sr-only" htmlFor={r.key + '-e'}>{label} end</label><input id={r.key + '-e'} type="time" step="300" value={r.end} required onChange={e => set(r.key, 'end', e.target.value)} />
              <button type="button" className="text-link" onClick={() => setRows(x => x.filter(y => y.key !== r.key))}>Remove<span className="sr-only"> {label} {r.start} to {r.end}</span></button>
            </div>) : <span className="quiet">Closed</span>}
            <button type="button" className="text-link" onClick={() => setRows(x => [...x, { key: key(), weekday: n, start: day.at(-1)?.end || '09:00', end: day.length ? '' : '17:00' }])}>Add hours<span className="sr-only"> on {label}</span></button>
          </div>
        </div>;
      })}
    </div>
    <Button disabled={busy}>Save hours</Button>
  </form>;
}

const isMidnight = iso => formatDate(iso, { dateStyle: undefined, timeStyle: undefined, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }) === '00:00';
function offText(t) {
  const day = iso => formatDate(iso, { dateStyle: 'medium', timeStyle: undefined });
  if (isMidnight(t.startsAt) && isMidnight(t.endsAt)) { const last = new Date(new Date(t.endsAt).getTime() - 1); const a = day(t.startsAt), b = day(last.toISOString()); return a === b ? a : a + ' to ' + b; }
  return formatDate(t.startsAt) + ' to ' + formatDate(t.endsAt);
}

function TimeOff({ doctor, entries, bookings, busy, run, onAction }) {
  const [partDay, setPartDay] = useState(false), [error, setError] = useState(''), [rebook, setRebook] = useState(null);
  const id = doctor.slug + '-off-';
  async function submit(e) {
    e.preventDefault(); setError(''); setRebook(null);
    const form = e.currentTarget, f = new FormData(form);
    const p = { doctor: doctor.slug, from: f.get('from'), to: f.get('to') || f.get('from'), fromTime: partDay ? f.get('fromTime') : '', toTime: partDay ? f.get('toTime') : '', reason: f.get('reason') };
    let off; try { off = validateTimeOff(p, clinic.timezone); } catch (err) { setError(err.message); return; }
    const affected = bookingsInTimeOff(bookings, doctor.slug, off);
    const r = await run(() => onAction('time-off-add', p), 'Time off saved. Those times are no longer open.');
    if (r !== false) { form.reset(); setPartDay(false); setRebook(r?.rebook || affected); }
  }
  return <section className="stack" aria-labelledby={id + 'title'}>
    <h3 id={id + 'title'}>Time off</h3>
    {rebook?.length > 0 && <Notice>These appointments are inside the time off and are still booked. Please contact the patients to rebook: {rebook.map(b => `${b.name} (${formatDate(b.start)})`).join('; ')}.</Notice>}
    {entries.length ? <ul className="schedule-list">{entries.map(t => <li key={t.id}><span>{offText(t)}{t.reason && <small>{t.reason}</small>}</span><button type="button" className="text-link" disabled={busy} onClick={() => run(() => onAction('time-off-remove', { id: t.id }), 'Time off removed. Those times are open again.')}>Remove<span className="sr-only"> time off {offText(t)}</span></button></li>)}</ul> : <p className="quiet">No upcoming time off.</p>}
    <form className="stack" onSubmit={submit} aria-label="Add time off">
      <Notice error>{error}</Notice>
      <div className="form-grid">
        <Field label="From" id={id + 'from'} name="from" type="date" required />
        <Field label="To (optional)" id={id + 'to'} name="to" type="date" hint="Leave empty for one day." />
      </div>
      <label className="checkbox-label"><input type="checkbox" checked={partDay} onChange={e => setPartDay(e.target.checked)} /><span>Part of a day<small>For a half day or a blocked hour. Times are in clinic time.</small></span></label>
      {partDay && <div className="form-grid">
        <Field label="From time" id={id + 'fromTime'} name="fromTime" type="time" step="300" required />
        <Field label="To time" id={id + 'toTime'} name="toTime" type="time" step="300" required />
      </div>}
      <Field label="Reason (optional, staff only)" id={id + 'reason'} name="reason" maxLength={120} placeholder="Vacation, conference…" />
      <Button secondary disabled={busy}>Add time off</Button>
    </form>
  </section>;
}

function ExtraDays({ doctor, entries, busy, run, onAction }) {
  const id = doctor.slug + '-extra-';
  async function submit(e) {
    e.preventDefault();
    const form = e.currentTarget, f = new FormData(form);
    const r = await run(() => onAction('extra-add', { doctor: doctor.slug, day: f.get('day'), start: f.get('start'), end: f.get('end') }), 'Extra hours saved. Those times are now open.');
    if (r !== false) form.reset();
  }
  return <section className="stack" aria-labelledby={id + 'title'}>
    <h3 id={id + 'title'}>Extra days</h3>
    <p className="quiet">One-off hours outside the weekly pattern, for example a Saturday clinic.</p>
    {entries.length ? <ul className="schedule-list">{entries.map(x => <li key={x.id}><span>{formatDate(x.day + 'T12:00:00Z', { dateStyle: 'full', timeStyle: undefined, timeZone: 'UTC' })} · {x.start}–{x.end}</span><button type="button" className="text-link" disabled={busy} onClick={() => run(() => onAction('extra-remove', { id: x.id }), 'Extra hours removed.')}>Remove<span className="sr-only"> extra hours on {x.day}</span></button></li>)}</ul> : <p className="quiet">No upcoming extra days.</p>}
    <form className="form-grid extra-form" onSubmit={submit} aria-label="Add extra hours">
      <Field label="Date" id={id + 'day'} name="day" type="date" required />
      <span />
      <Field label="From" id={id + 'start'} name="start" type="time" step="300" required />
      <Field label="To" id={id + 'end'} name="end" type="time" step="300" required />
      <Button secondary disabled={busy}>Add extra hours</Button>
    </form>
  </section>;
}
