'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Script from 'next/script';
import Link from 'next/link';
import { useApp } from './provider';
import { DEMO, clinic, services, brands, doctors, doctorName, formatDate, instructions } from '@/lib/config';
import { validateBooking, slotTaken } from '@/lib/validation';
import { calendarFile, googleCalendar, outlookCalendar, downloadFile } from '@/lib/calendar';
import { Header, Footer, Button, Field, Gift, Icon, Notice, Loading, Referral } from './ui';

function Captcha({ onToken }) {
  const el = useRef(null), [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (!loaded || !el.current || !window.turnstile) return;
    const id = window.turnstile.render(el.current, { sitekey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY, action: 'booking', callback: onToken, 'expired-callback': () => onToken('') });
    return () => window.turnstile?.remove(id);
  }, [loaded]);
  return <><Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" onReady={() => setLoaded(true)} /><div ref={el} /></>;
}

const LABELS = ['Appointment', 'Date and time', 'Your details', 'Confirmed'];
const TITLES = ['What would you like to book?', 'When works for you?', 'Your details', 'You’re booked'];
// Date ranges in days from today. "This week" ends on Sunday so it matches how people say it.
function ranges() {
  const now = new Date(), toSunday = 7 - ((now.getDay() + 6) % 7 + 1) + 1;
  return [
    { label: 'This week', from: 0, to: toSunday },
    { label: 'Next week', from: toSunday, to: toSunday + 7 },
    { label: 'In 2–3 weeks', from: toSunday + 7, to: toSunday + 21 },
    { label: 'Later', from: toSunday + 21, to: Infinity }
  ];
}
// Pick the calendar that this device most likely uses for the one-tap button.
function preferredCalendar() {
  if (typeof navigator === 'undefined') return 'google';
  const ua = navigator.userAgent;
  if (/iPhone|iPad|Macintosh/.test(ua)) return 'apple';
  if (/Windows/.test(ua)) return 'outlook';
  return 'google';
}

export default function BookingFlow() {
  const params = useSearchParams(), slug = params.get('affiliate'), { data, ready, book } = useApp();
  const [affiliate, setAffiliate] = useState(null);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [step, setStep] = useState(0);
  const [service, setService] = useState(params.get('service') || '');
  const [day, setDay] = useState('');
  const [start, setStart] = useState('');
  const [range, setRange] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const [captcha, setCaptcha] = useState('');
  const [captchaKey, setCaptchaKey] = useState(0);
  const [added, setAdded] = useState('');
  const [calendar, setCalendar] = useState('google');
  // A brand passed in the link (from the collections carousel) arrives already chosen; unknown names are ignored.
  const linkedBrand = brands.find(b => b.toLowerCase() === (params.get('brand') || '').trim().toLowerCase());
  const [details, setDetails] = useState({ name: '', email: '', phone: '', firstVisit: '', insurance: '', policy: '', brands: linkedBrand ? [linkedBrand] : [], smsConsent: false, website: '' });
  // An optometrist passed in the link (from their card on the home page) is kept as a preference; unknown slugs are ignored.
  const [preferredDoctor, setPreferredDoctor] = useState(() => doctors.find(d => d.slug === params.get('doctor'))?.slug || '');
  const titleRef = useRef(null), firstRender = useRef(true);

  useEffect(() => { setCalendar(preferredCalendar()); }, []);
  useEffect(() => {
    if (DEMO) {
      if (!ready) return;
      const a = slug ? data.affiliates.find(a => a.slug === slug && a.active) : null;
      if (slug && !a) { setLoadError('This referral is unavailable. You can book directly instead.'); setLoading(false); return; }
      setAffiliate(a);
      setSlots(data.slots.filter(s => new Date(s.start) > new Date() && !slotTaken(s, data.bookings)));
      setLoading(false);
    } else {
      fetch('/api/availability' + (slug ? '?affiliate=' + encodeURIComponent(slug) : ''))
        .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); setAffiliate(d.affiliate); setSlots(d.slots); })
        .catch(e => setLoadError(e.message)).finally(() => setLoading(false));
    }
  }, [ready, slug, data]);
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    titleRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step]);

  const dayKey = iso => new Intl.DateTimeFormat('en-CA', { timeZone: clinic.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
  const days = useMemo(() => [...new Map(slots.map(s => [dayKey(s.start), s.start])).entries()], [slots]);
  const rangeList = useMemo(ranges, []);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const inRange = (iso, r) => { const d = (new Date(iso) - today) / 86400000; return d >= r.from && d < r.to; };
  const visibleDays = days.filter(([, iso]) => inRange(iso, rangeList[range]));
  const chosenService = services.find(s => s.id === service);

  // Open on the first range that has times, so nobody lands on an empty week.
  useEffect(() => {
    if (!slots.length || step !== 1 || visibleDays.length) return;
    const first = rangeList.findIndex(r => days.some(([, iso]) => inRange(iso, r)));
    if (first > -1 && first !== range) setRange(first);
  }, [step, slots.length]);

  function change(key, value) { setDetails(d => ({ ...d, [key]: value })); }
  function toggleBrand(b) { setDetails(d => ({ ...d, brands: d.brands.includes(b) ? d.brands.filter(x => x !== b) : [...d.brands, b] })); }
  function next() {
    setError('');
    if (step === 0 && !chosenService) { setError('Choose the care you need.'); return; }
    if (step === 1 && !start) { setError('Choose a date and an available time.'); return; }
    setStep(s => s + 1);
  }
  function back(to) { setError(''); setStep(to); }
  async function submit(e) {
    e.preventDefault(); setError(''); setBusy(true);
    try {
      const payload = validateBooking({ ...details, brands: details.brands.join(', '), firstVisit: details.firstVisit === 'yes' ? true : details.firstVisit === 'no' ? false : null, service, start, affiliateId: affiliate?.id, preferredDoctor: preferredDoctor || null });
      if (!DEMO && !captcha) throw new Error('Complete the verification before booking.');
      const result = await book({ ...payload, captcha, website: details.website });
      setConfirmation(result); setStep(3);
    } catch (e) { setError(e.message); setCaptcha(''); setCaptchaKey(k => k + 1); }
    finally { setBusy(false); }
  }
  function addTo(kind) {
    const b = confirmation.booking;
    if (kind === 'apple') downloadFile(calendarFile(b), 'eyecon-appointment.ics', 'text/calendar');
    else window.open(kind === 'google' ? googleCalendar(b) : outlookCalendar(b), '_blank', 'noopener,noreferrer');
    setAdded(kind);
  }

  if (loading) return <Loading />;
  if (loadError) return <><Header /><main className="container empty-page" id="main-content"><h1>Arrange your visit</h1><Notice error>{loadError}</Notice>{slug ? <Button href="/booking">Book directly</Button> : <Button onClick={() => window.location.reload()}>Try again</Button>}</main><Footer /></>;

  const calendarNames = { google: 'Google Calendar', apple: 'Apple Calendar', outlook: 'Outlook' };
  const preferred = preferredDoctor && <p className="preferred-doctor"><span>Preferred optometrist: <strong>{doctorName(preferredDoctor)}</strong></span><button type="button" className="text-link" onClick={() => setPreferredDoctor('')}>Remove</button></p>;
  return <>
    <Header bookingHref={affiliate ? '/book/' + affiliate.slug : '/'} bookingLabel="Back to Eyecon" />
    <main className="booking-shell" id="main-content">
      <aside className="booking-aside">
        <h1>A little time, a clearer view.</h1>
        <p>Choose your appointment and a time that suits you. It takes about a minute.</p>
        {affiliate && <><Referral affiliate={affiliate} />{step < 3 && <Gift compact />}</>}
        <div className="booking-help">
          <Icon name="phone" />
          <h3>Prefer to talk to us?</h3>
          {clinic.phone ? <a href={'tel:' + clinic.phone}>{clinic.phone}</a> : <p>The clinic phone number will be added before launch.</p>}
        </div>
      </aside>

      <section className="booking-panel">
        {affiliate && <p className="booking-ref"><img src={affiliate.photo || '/images/affiliate.webp'} alt="" width="32" height="32" /><span>Booking through <strong>{affiliate.name}</strong>{step < 3 && <>, with a $50 gift card</>}</span></p>}
        <div className="progress" aria-label={`Step ${step + 1} of 4: ${LABELS[step]}`}>
          <div className="progress-track"><div className="progress-fill" style={{ width: ((step + 1) / 4) * 100 + '%' }} /></div>
          <ol className="stepper" aria-hidden="true">{LABELS.map((l, i) => <li key={l} className={i < step ? 'done' : ''} aria-current={i === step ? 'step' : undefined}><span className="num">{i + 1}</span>{l}</li>)}</ol>
        </div>
        <h2 ref={titleRef} tabIndex={-1}>{TITLES[step]}</h2>
        <Notice error>{error}</Notice>

        {step === 0 && <div className="step" key="s0">
          <div className="service-choices" role="radiogroup" aria-label="Appointment type">
            {services.map(s => <label key={s.id} className={`service-choice ${service === s.id ? 'selected' : ''}`}>
              <input type="radio" name="service" value={s.id} checked={service === s.id} onChange={() => setService(s.id)} />
              <Icon name={s.icon} />
              <span><strong>{s.name}</strong><small>{s.description}</small></span>
            </label>)}
          </div>
          <p className="urgent-note">Urgent eye concern? {clinic.phone ? <a href={'tel:' + clinic.phone}>Call the clinic</a> : 'Please call the clinic for guidance.'}</p>
          <div className="form-actions"><Button onClick={next} disabled={!chosenService}>Continue</Button></div>
        </div>}

        {step === 1 && <div className="step" key="s1">
          <p className="muted">{chosenService?.name}</p>
          {preferred}
          {!slots.length ? <Notice>No online times are available right now. Please call the clinic or check back later.</Notice> : <>
            <div className="week-tabs" role="group" aria-label="When">
              {rangeList.map((r, i) => <button type="button" key={r.label} className={range === i ? 'active' : ''} aria-pressed={range === i} onClick={() => { setRange(i); setDay(''); setStart(''); }}>{r.label}</button>)}
            </div>
            {visibleDays.length
              ? <div className="day-grid" role="group" aria-label="Available days">
                  {visibleDays.map(([key, iso]) => <button type="button" key={key} className={day === key ? 'active' : ''} aria-pressed={day === key} onClick={() => { setDay(key); setStart(''); }}>
                    <small>{formatDate(iso, { dateStyle: undefined, timeStyle: undefined, weekday: 'short' })}</small>
                    <span>{formatDate(iso, { dateStyle: undefined, timeStyle: undefined, day: 'numeric' })}</span>
                    <small>{formatDate(iso, { dateStyle: undefined, timeStyle: undefined, month: 'short' })}</small>
                  </button>)}
                </div>
              : <p className="empty-range">No open times in this range. Try another.</p>}
            {day && <>
              <p className="time-label">Available times</p>
              <div className="time-grid" role="group" aria-label="Available times" key={day}>
                {slots.filter(s => dayKey(s.start) === day).map((s, i) => <button type="button" key={s.start} style={{ animationDelay: i * 30 + 'ms' }} aria-pressed={start === s.start} className={start === s.start ? 'active' : ''} onClick={() => setStart(s.start)}>{formatDate(s.start, { dateStyle: undefined, timeStyle: 'short' })}</button>)}
              </div>
            </>}
            {!day && visibleDays.length > 0 && <p className="quiet">Pick a day to see the times.</p>}
            {start && <div className="selection-summary"><Icon name="calendar" /><div><strong>{chosenService?.name}</strong><small>{formatDate(start, { dateStyle: 'full', timeStyle: 'short' })}</small></div></div>}
          </>}
          <div className="form-actions"><Button secondary onClick={() => back(0)}>Back</Button><Button onClick={next} disabled={!start}>Continue</Button></div>
        </div>}

        {step === 2 && <form onSubmit={submit} className="stack step" key="s2">
          <div className="selection-summary"><Icon name="calendar" /><div><strong>{chosenService?.name}</strong><small>{formatDate(start, { dateStyle: 'full', timeStyle: 'short' })}</small></div><button type="button" className="text-link" onClick={() => back(1)}>Change</button></div>
          {preferred}
          <Field label="Full name" id="patient-name" autoComplete="name" required maxLength={120} value={details.name} onChange={e => change('name', e.target.value)} />
          <div className="form-grid">
            <Field label="Mobile number" id="patient-phone" type="tel" autoComplete="tel" required maxLength={32} placeholder="+1 416 555 0123" value={details.phone} onChange={e => change('phone', e.target.value)} />
            <Field label="Email address" id="patient-email" type="email" autoComplete="email" required value={details.email} onChange={e => change('email', e.target.value)} />
          </div>
          <fieldset className="choice-field"><legend>Is this your first visit to Eyecon?</legend>
            {['yes', 'no'].map(v => <label key={v}><input type="radio" name="first-visit" required checked={details.firstVisit === v} onChange={() => change('firstVisit', v)} />{v === 'yes' ? 'Yes, first visit' : 'I’ve been before'}</label>)}
          </fieldset>
          <details className="optional-fields"><summary>Insurance details <small>Optional</small></summary>
            <div className="stack">
              <Field label="Insurance company" id="insurance" value={details.insurance} maxLength={120} onChange={e => change('insurance', e.target.value)} list={clinic.insurers.length ? 'insurer-options' : undefined} />
              {clinic.insurers.length > 0 && <datalist id="insurer-options">{clinic.insurers.map(i => <option key={i} value={i} />)}</datalist>}
              <Field label="Policy number" id="policy" value={details.policy} maxLength={120} onChange={e => change('policy', e.target.value)} hint="Only clinic staff can see this. You can bring your insurance card instead." />
            </div>
          </details>
          <details className="optional-fields" open><summary>Designers you love <small>Optional</small></summary>
            <div className="brand-chips" role="group" aria-label="Favourite designers">
              {brands.map(b => <button type="button" key={b} aria-pressed={details.brands.includes(b)} onClick={() => toggleBrand(b)}>{details.brands.includes(b) && <Icon name="check" size={14} />}{b}</button>)}
            </div>
            <p className="quiet" style={{ marginTop: '.8rem' }}>We’ll have these ready for you to try.</p>
          </details>
          <label className="checkbox-label"><input type="checkbox" checked={details.smsConsent} onChange={e => change('smsConsent', e.target.checked)} /><span>Text me appointment reminders{affiliate ? ' and my gift card details' : ''}.<small>Optional. Message and data rates may apply. Contact the clinic to stop.</small></span></label>
          <p className="privacy-note">{affiliate ? `${affiliate.name} can see your name and booking status. Your appointment type and insurance stay with the clinic. ` : ''}Read our <Link href="/privacy">privacy notice</Link>.</p>
          <div className="honeypot" aria-hidden="true"><label htmlFor="website">Leave this blank</label><input id="website" value={details.website} onChange={e => change('website', e.target.value)} tabIndex={-1} autoComplete="off" /></div>
          {!DEMO && <Captcha key={captchaKey} onToken={setCaptcha} />}
          <div className="form-actions"><Button type="button" secondary onClick={() => back(1)}>Back</Button><Button disabled={busy} type="submit">{busy ? 'Booking…' : 'Confirm booking'}</Button></div>
        </form>}

        {step === 3 && confirmation && <div className="confirmation step" key="s3">
          <div className="success-mark"><Icon name="check" size={34} /></div>
          <p className="confirmation-lead">We look forward to seeing you, {confirmation.booking.name.split(' ')[0]}.</p>
          <div className="confirmation-card">
            <h3>{services.find(s => s.id === confirmation.booking.service)?.name}</h3>
            <p className="ref">Reference<strong>{confirmation.booking.id.slice(0, 8).toUpperCase()}</strong></p>
            <p>{formatDate(confirmation.booking.start, { dateStyle: 'full', timeStyle: 'short' })}</p>
            <p className="muted">{clinic.address || 'The clinic will confirm the location with you.'}</p>
          </div>

          <div className="calendar-card">
            <h3>Add it to your calendar</h3>
            <p>One tap, so you won’t miss it. Your confirmation email has the invite too.</p>
            <div className="calendar-actions">
              <button type="button" className="button primary" onClick={() => addTo(calendar)}><Icon name="calendar" size={20} />Add to {calendarNames[calendar]}</button>
              {['google', 'apple', 'outlook'].filter(k => k !== calendar).map(k => <button type="button" key={k} className="button" onClick={() => addTo(k)}>{calendarNames[k]}</button>)}
            </div>
            {added && <p className="calendar-added" role="status"><Icon name="check" size={18} />Opened in {calendarNames[added]}. Save it there to finish.</p>}
          </div>

          {affiliate && <Gift />}
          <h3 className="plain">Before your visit</h3>
          <ul className="check-list">{instructions.map(t => <li key={t}><Icon name="check" size={18} />{t}</li>)}</ul>
          <Notice>{DEMO ? 'Demo booking saved in this browser. No email or SMS was sent.' : confirmation.notifications?.email === 'sent' ? 'Your confirmation email is on its way. Check your inbox.' : 'Your booking is saved. Keep your reference and add it to your calendar above.'}</Notice>
          <Button secondary href={affiliate ? '/book/' + affiliate.slug : '/'}>Return to Eyecon</Button>
        </div>}
      </section>
    </main>
    <Footer />
  </>;
}
