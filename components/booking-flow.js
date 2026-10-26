'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useApp } from './provider';
import DocumentsForm from './documents-form';
import Captcha from './captcha';
import CalendarCard from './calendar-card';
import Image from 'next/image';
import { DEMO, clinic, services, brands, brandFromParam, doctorName, findDoctor, formatDate, instructions, serviceOptions, serviceOptionName } from '@/lib/config';
import { websiteList, offersService, inTimeOff } from '@/lib/schedule';
import SkinTechnologies from './skin-technologies';
import { BookingReviews } from './reviews';
import { validateBooking, slotTaken } from '@/lib/validation';
import { Header, Footer, Button, Field, Gift, Icon, Notice, Loading, Referral } from './ui';

// Optometrist cards: photo, name and focus. With counts, each card says how many online times they have and
// a card with none cannot be chosen.
function DoctorChoices({ name, label, list, value, counts, onChange }) {
  return <div className="doctor-choices" role="radiogroup" aria-label={label}>
    {list.map(d => {
      const open = counts?.[d.slug], none = counts && !open;
      return <label key={d.slug} className={`doctor-choice ${value === d.slug ? 'selected' : ''} ${none ? 'unavailable' : ''}`}>
        <input type="radio" name={name} value={d.slug} checked={value === d.slug} disabled={none} onChange={() => onChange(d.slug)} />
        <Image src={d.photo} alt={d.alt || ''} width={64} height={80} sizes="64px" />
        <span><strong>{doctorName(d.slug)}</strong><small>{d.focus}</small>{counts && <small className="doctor-choice-open">{none ? 'No online times' : `${open} open time${open === 1 ? '' : 's'}`}</small>}</span>
      </label>;
    })}
  </div>;
}

const LABELS = ['Appointment', 'Date and time', 'Your details', 'Confirmed'];
const TITLES = ['What would you like to book?', 'When works for you?', 'Your details', 'You’re booked'];
// "Already have a prescription" (affiliate links only): no appointment, just the $50 card emailed to use in store.
const CLAIM_LABELS = ['Choose', 'Your details', 'Gift card ready'];
const CLAIM_TITLES = ['What would you like to book?', 'Claim your gift card', 'Your gift card is ready'];
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

export default function BookingFlow() {
  const params = useSearchParams(), slug = params.get('affiliate'), { data, ready, book, claimGift, doctors: allDoctors, doctorsReady } = useApp();
  const [affiliate, setAffiliate] = useState(null);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  // 'book' is the appointment booking. 'claim' is "Already have a prescription", offered only through an affiliate's
  // link; the affiliate page's prescription link opens it directly on the details form.
  const linkedClaim = params.get('claim') === 'prescription';
  const [path, setPath] = useState(linkedClaim ? 'claim' : 'book');
  const [step, setStep] = useState(linkedClaim ? 1 : 0);
  const [claim, setClaim] = useState({ name: '', email: '', healthCard: '', insurance: '', policy: '', website: '' });
  const [claimed, setClaimed] = useState(null);
  const [service, setService] = useState(params.get('service') || '');
  // An optional choice within the service, such as the skin tightening technology. One passed in the link (from a
  // technology card on the home page) arrives already chosen; unknown slugs are ignored.
  const [serviceOption, setServiceOption] = useState(() => serviceOptions[params.get('service')]?.find(o => o.slug === params.get('option'))?.slug || '');
  const [day, setDay] = useState('');
  const [start, setStart] = useState('');
  const [range, setRange] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const [captcha, setCaptcha] = useState('');
  const [captchaKey, setCaptchaKey] = useState(0);
  // A brand passed in the link (from the collections carousel) arrives already chosen; unknown names are ignored.
  const linkedBrand = brandFromParam(params.get('brand'));
  const [details, setDetails] = useState({ name: '', email: '', phone: '', firstVisit: '', insurance: '', policy: '', brands: linkedBrand ? [linkedBrand] : [], smsConsent: false, website: '' });
  // Every appointment is with one optometrist. Patients either pick the optometrist first ("doctor" mode) or the time
  // first ("time" mode). An optometrist passed in the link (from their card on the home page) opens doctor mode with
  // them already chosen; unknown slugs are ignored.
  // The live list of optometrists arrives after the first render, so the slug is checked once it has loaded.
  const linkedDoctor = params.get('doctor') || '';
  const [mode, setMode] = useState(linkedDoctor ? 'doctor' : 'time');
  const [doctor, setDoctor] = useState(linkedDoctor);
  // Optometrists patients can book online: shown on the website and performing the chosen service.
  const bookable = useMemo(() => websiteList(allDoctors).filter(d => offersService(d, service)), [allDoctors, service]);
  useEffect(() => {
    if (!doctorsReady || !doctor || bookable.some(d => d.slug === doctor)) return;
    setDoctor(''); setDay(''); setStart(''); setMode('time');
  }, [doctorsReady, bookable]);
  const titleRef = useRef(null), firstRender = useRef(true);

  useEffect(() => {
    if (DEMO) {
      if (!ready) return;
      const a = slug ? data.affiliates.find(a => a.slug === slug && a.active) : null;
      if (slug && !a) { setLoadError('This referral is unavailable. You can book directly instead.'); setLoading(false); return; }
      setAffiliate(a);
      setSlots(data.slots.filter(s => new Date(s.start) > new Date() && findDoctor(s.doctor) && !slotTaken(s, data.bookings) && !inTimeOff(s, data.timeOff)));
      setLoading(false);
    } else {
      fetch('/api/availability' + (slug ? '?affiliate=' + encodeURIComponent(slug) : ''))
        .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); setAffiliate(d.affiliate); setSlots(d.slots.filter(s => findDoctor(s.doctor))); })
        .catch(e => setLoadError(e.message)).finally(() => setLoading(false));
    }
  }, [ready, slug, data]);
  // Without an active affiliate there is no gift card to claim, so the link falls back to booking.
  useEffect(() => { if (!loading && !affiliate && path === 'claim') { setPath('book'); setStep(0); } }, [loading, affiliate]);
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    titleRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step]);

  const dayKey = iso => new Intl.DateTimeFormat('en-CA', { timeZone: clinic.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
  // The times on offer: one optometrist's in doctor mode, everyone's in time mode.
  // Only times with an optometrist who is shown online and performs the chosen service.
  const offered = useMemo(() => slots.filter(s => bookable.some(d => d.slug === s.doctor)), [slots, bookable]);
  const pool = useMemo(() => mode === 'doctor' ? offered.filter(s => s.doctor === doctor) : offered, [offered, mode, doctor]);
  const openCount = useMemo(() => Object.fromEntries(bookable.map(d => [d.slug, offered.filter(s => s.doctor === d.slug).length])), [offered, bookable]);
  const days = useMemo(() => [...new Map(pool.map(s => [dayKey(s.start), s.start])).entries()], [pool]);
  // Each start time on the chosen day, with the optometrists free at that moment.
  const times = useMemo(() => { const m = new Map(); for (const s of pool) if (dayKey(s.start) === day) m.set(s.start, [...(m.get(s.start) || []), s.doctor]); return [...m.entries()]; }, [pool, day]);
  const freeAtStart = times.find(([iso]) => iso === start)?.[1] || [];
  const rangeList = useMemo(ranges, []);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const inRange = (iso, r) => { const d = (new Date(iso) - today) / 86400000; return d >= r.from && d < r.to; };
  const visibleDays = days.filter(([, iso]) => inRange(iso, rangeList[range]));
  const chosenService = services.find(s => s.id === service);
  const chosen = !!(start && doctor && offered.some(s => s.doctor === doctor && s.start === start));

  // Open on the first range that has times, so nobody lands on an empty week.
  useEffect(() => {
    if (!pool.length || step !== 1 || visibleDays.length) return;
    const first = rangeList.findIndex(r => days.some(([, iso]) => inRange(iso, r)));
    if (first > -1 && first !== range) setRange(first);
  }, [step, pool.length, mode, doctor]);

  function change(key, value) { setDetails(d => ({ ...d, [key]: value })); }
  function toggleBrand(b) { setDetails(d => ({ ...d, brands: d.brands.includes(b) ? d.brands.filter(x => x !== b) : [...d.brands, b] })); }
  // In time mode the optometrist follows from the time, so clearing the time clears them too.
  function clearTime(nextDay = '') { setDay(nextDay); setStart(''); if (mode === 'time') setDoctor(''); }
  function switchMode(m) { if (m === mode) return; setError(''); setMode(m); setDay(''); setStart(''); if (m === 'time') setDoctor(''); }
  function pickDoctor(slug) { setError(''); setDoctor(slug); setDay(''); setStart(''); }
  function pickTime(iso, free) { setError(''); setStart(iso); if (mode === 'time') setDoctor(free.length === 1 ? free[0] : ''); }
  function next() {
    setError('');
    if (step === 0 && path === 'book' && !chosenService) { setError('Choose the care you need.'); return; }
    if (step === 1 && !chosen) { setError(start && !doctor ? 'Choose which optometrist you would like to see.' : 'Choose an optometrist and an available time.'); return; }
    setStep(s => s + 1);
  }
  function back(to) { setError(''); setStep(to); }
  function choose(next) { setError(''); setPath(next); if (next === 'claim') { setService(''); setServiceOption(''); } }
  function changeClaim(key, value) { setClaim(c => ({ ...c, [key]: value })); }
  async function submitClaim(e) {
    e.preventDefault(); setError(''); setBusy(true);
    try {
      if (!DEMO && !captcha) throw new Error('Complete the verification before claiming.');
      const result = await claimGift({ ...claim, affiliateId: affiliate?.id, captcha });
      setClaimed(result); setStep(2);
    } catch (e) { setError(e.message); setCaptcha(''); setCaptchaKey(k => k + 1); }
    finally { setBusy(false); }
  }
  async function submit(e) {
    e.preventDefault(); setError(''); setBusy(true);
    try {
      const payload = validateBooking({ ...details, brands: details.brands.join(', '), firstVisit: details.firstVisit === 'yes' ? true : details.firstVisit === 'no' ? false : null, service, serviceOption, start, doctor, affiliateId: affiliate?.id });
      if (!DEMO && !captcha) throw new Error('Complete the verification before booking.');
      const result = await book({ ...payload, captcha, website: details.website });
      setConfirmation(result); setStep(3);
    } catch (e) { setError(e.message); setCaptcha(''); setCaptchaKey(k => k + 1); }
    finally { setBusy(false); }
  }

  if (loading || !doctorsReady) return <Loading />;
  if (loadError) return <><Header /><main className="container empty-page" id="main-content"><h1>Arrange your visit</h1><Notice error>{loadError}</Notice>{slug ? <Button href="/booking">Book directly</Button> : <Button onClick={() => window.location.reload()}>Try again</Button>}</main><Footer /></>;

  const optionName = serviceOptionName(service, serviceOption);
  const summary = (action = null) => <div className="selection-summary"><Icon name="calendar" /><div><strong>{chosenService?.name}{optionName && <> · {optionName}</>}</strong><small>With {doctorName(doctor)}</small><small>{formatDate(start, { dateStyle: 'full', timeStyle: 'short' })}</small></div>{action}</div>;
  const labels = path === 'claim' ? CLAIM_LABELS : LABELS, titles = path === 'claim' ? CLAIM_TITLES : TITLES;
  const done = step === labels.length - 1;
  const timeText = iso => formatDate(iso, { dateStyle: undefined, timeStyle: 'short' });
  const shortName = slug => { const d = findDoctor(slug); return d ? `${d.title} ${d.last}` : ''; };
  return <>
    <Header bookingHref={affiliate ? '/book/' + affiliate.slug : '/'} bookingLabel="Back to Eyecon" bookingShort="Back" />
    <main className="booking-shell" id="main-content">
      <aside className="booking-aside">
        <h1>A little time, a clearer view.</h1>
        <p>Choose your appointment and a time that suits you. It takes about a minute.</p>
        {affiliate && <><Referral affiliate={affiliate} />{!done && <Gift compact affiliate={affiliate} />}</>}
        <div className="booking-help">
          <Icon name="phone" />
          <h3>Prefer to talk to us?</h3>
          {clinic.phone ? <a href={clinic.phoneHref}>{clinic.phone}</a> : <p>The clinic phone number will be added before launch.</p>}
        </div>
        <BookingReviews />
      </aside>

      <section className="booking-panel">
        {affiliate && <p className="booking-ref"><img src={affiliate.photo || '/images/affiliate.webp'} alt="" width="32" height="32" /><span>Booking through <strong>{affiliate.name}</strong>{!done && <>, with a $50 gift card</>}</span></p>}
        <div className="progress" aria-label={`Step ${step + 1} of ${labels.length}: ${labels[step]}`}>
          <div className="progress-track"><div className="progress-fill" style={{ width: ((step + 1) / labels.length) * 100 + '%' }} /></div>
          <ol className={`stepper ${labels.length === 3 ? 'three' : ''}`} aria-hidden="true">{labels.map((l, i) => <li key={l} className={i < step ? 'done' : ''} aria-current={i === step ? 'step' : undefined}><span className="num">{i + 1}</span>{l}</li>)}</ol>
        </div>
        <h2 ref={titleRef} tabIndex={-1}>{titles[step]}</h2>
        <Notice error>{error}</Notice>

        {step === 0 && <div className="step" key="s0">
          <div className="service-choices" role="radiogroup" aria-label="Appointment type">
            {services.map(s => <label key={s.id} className={`service-choice ${path === 'book' && service === s.id ? 'selected' : ''}`}>
              <input type="radio" name="service" value={s.id} checked={path === 'book' && service === s.id} onChange={() => { choose('book'); setService(s.id); if (!serviceOptions[s.id]) setServiceOption(''); }} />
              <Icon name={s.icon} />
              <span><strong>{s.name}</strong><small>{s.description}</small></span>
            </label>)}
            {affiliate && <label className={`service-choice prescription-choice ${path === 'claim' ? 'selected' : ''}`}>
              <input type="radio" name="service" value="prescription" checked={path === 'claim'} onChange={() => choose('claim')} />
              <Icon name="gift" />
              <span><strong>Already have a prescription</strong><small>Skip the exam. We’ll email your $50 gift card to use on eyewear in store.</small></span>
            </label>}
          </div>
          {path === 'book' && service === 'skin-tightening' && <SkinTechnologies value={serviceOption} onChange={setServiceOption} />}
          <p className="urgent-note">Urgent eye concern? {clinic.phone ? <a href={clinic.phoneHref}>Call the clinic</a> : 'Please call the clinic for guidance.'}</p>
          <div className="form-actions"><Button onClick={next} disabled={path === 'book' && !chosenService}>Continue</Button></div>
        </div>}

        {path === 'book' && step === 1 && <div className="step" key="s1">
          <p className="muted">{chosenService?.name}</p>
          <div className="mode-toggle" role="group" aria-label="How would you like to choose?">
            {[['doctor', 'Choose a doctor'], ['time', 'Choose a time']].map(([m, label]) => <button type="button" key={m} className={mode === m ? 'active' : ''} aria-pressed={mode === m} onClick={() => switchMode(m)}>{label}</button>)}
          </div>
          {!slots.length ? <Notice>No online times are available right now. Please call the clinic or check back later.</Notice> : <>
            {mode === 'doctor' && <>
              <p className="time-label">Your optometrist</p>
              <DoctorChoices name="doctor" label="Optometrist" list={bookable} value={doctor} counts={openCount} onChange={pickDoctor} />
              {!doctor && <p className="quiet">Pick an optometrist to see the days they are available.</p>}
            </>}
            {(mode === 'time' || doctor) && (pool.length ? <>
              <div className="week-tabs" role="group" aria-label="When">
                {rangeList.map((r, i) => <button type="button" key={r.label} className={range === i ? 'active' : ''} aria-pressed={range === i} onClick={() => { setRange(i); clearTime(); }}>{r.label}</button>)}
              </div>
              {visibleDays.length
                ? <div className="day-grid" role="group" aria-label={mode === 'doctor' ? 'Days ' + doctorName(doctor) + ' is available' : 'Available days'}>
                    {visibleDays.map(([key, iso]) => <button type="button" key={key} className={day === key ? 'active' : ''} aria-pressed={day === key} onClick={() => clearTime(key)}>
                      <small>{formatDate(iso, { dateStyle: undefined, timeStyle: undefined, weekday: 'short' })}</small>
                      <span>{formatDate(iso, { dateStyle: undefined, timeStyle: undefined, day: 'numeric' })}</span>
                      <small>{formatDate(iso, { dateStyle: undefined, timeStyle: undefined, month: 'short' })}</small>
                    </button>)}
                  </div>
                : <p className="empty-range">No open times in this range. Try another.</p>}
              {day && <>
                <p className="time-label">Available times</p>
                <div className={`time-grid ${mode === 'time' ? 'with-doctors' : ''}`} role="group" aria-label="Available times" key={mode + day}>
                  {times.map(([iso, free], i) => {
                    const names = free.map(doctorName).join(' and ');
                    return <button type="button" key={iso} style={{ animationDelay: i * 30 + 'ms' }} aria-pressed={start === iso} className={start === iso ? 'active' : ''} onClick={() => pickTime(iso, free)}
                      aria-label={mode === 'time' ? `${timeText(iso)}, with ${names}` : undefined} title={mode === 'time' ? names : undefined}>
                      {timeText(iso)}
                      {mode === 'time' && <span className="time-doctors" aria-hidden="true">
                        <span className="time-avatars">{free.map(slug => <Image key={slug} src={findDoctor(slug).photo} alt="" width={20} height={20} sizes="20px" />)}</span>
                        <small>{free.map(shortName).join(' · ')}</small>
                      </span>}
                    </button>;
                  })}
                </div>
              </>}
              {!day && visibleDays.length > 0 && <p className="quiet">Pick a day to see the times.</p>}
              {mode === 'time' && start && freeAtStart.length > 1 && <div className="doctor-pick">
                <p className="time-label">Who would you like to see? {freeAtStart.length} optometrists are free at {timeText(start)}</p>
                <DoctorChoices name="doctor-at-time" label={'Optometrist at ' + timeText(start)} list={bookable.filter(d => freeAtStart.includes(d.slug))} value={doctor} onChange={slug => { setError(''); setDoctor(slug); }} />
              </div>}
              {chosen && summary()}
            </> : <p className="empty-range">{doctorName(doctor)} has no online times right now. Choose another optometrist, or switch to “Choose a time”.</p>)}
          </>}
          <div className="form-actions"><Button secondary onClick={() => back(0)}>Back</Button><Button onClick={next} disabled={!chosen}>Continue</Button></div>
        </div>}

        {path === 'book' && step === 2 && <form onSubmit={submit} className="stack step" key="s2">
          {summary(<button type="button" className="text-link" onClick={() => back(1)}>Change</button>)}
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
          {!DEMO && <Captcha key={captchaKey} action="booking" onToken={setCaptcha} />}
          <div className="form-actions"><Button type="button" secondary onClick={() => back(1)}>Back</Button><Button disabled={busy} type="submit">{busy ? 'Booking…' : 'Confirm booking'}</Button></div>
        </form>}

        {path === 'book' && step === 3 && confirmation && <div className="confirmation step" key="s3">
          <div className="success-mark"><Icon name="check" size={34} /></div>
          <p className="confirmation-lead">We look forward to seeing you, {confirmation.booking.name.split(' ')[0]}.</p>
          <div className="confirmation-card">
            <h3>{services.find(s => s.id === confirmation.booking.service)?.name}</h3>
            {serviceOptionName(confirmation.booking.service, confirmation.booking.serviceOption) && <p>{serviceOptionName(confirmation.booking.service, confirmation.booking.serviceOption)}</p>}
            <p className="ref">Reference<strong>{confirmation.booking.reference}</strong></p>
            <p>With {doctorName(confirmation.booking.doctor)}</p>
            <p>{formatDate(confirmation.booking.start, { dateStyle: 'full', timeStyle: 'short' })}</p>
            <p className="muted">{clinic.address || 'The clinic will confirm the location with you.'}</p>
          </div>

          <DocumentsForm token={confirmation.booking.documentsToken} canSkip />

          <CalendarCard booking={confirmation.booking} />

          {affiliate && confirmation.booking.giftCard && <Gift affiliate={affiliate} card={confirmation.booking.giftCard} />}
          <h3 className="plain">Before your visit</h3>
          <ul className="check-list">{instructions.map(t => <li key={t}><Icon name="check" size={18} />{t}</li>)}</ul>
          <Notice>{DEMO ? 'Demo booking saved in this browser. No email or SMS was sent.' : confirmation.notifications?.email === 'sent' ? 'Your confirmation email is on its way. Check your inbox.' : 'Your booking is saved. Keep your reference and add it to your calendar above.'}</Notice>
          <Button secondary href={affiliate ? '/book/' + affiliate.slug : '/'}>Return to Eyecon</Button>
        </div>}
        {path === 'claim' && step === 1 && <form onSubmit={submitClaim} className="stack step" key="c1">
          <div className="selection-summary"><Icon name="gift" /><div><strong>Already have a prescription</strong><small>We’ll email your $50 gift card. Bring your prescription to the clinic and use the card on your eyewear.</small></div><button type="button" className="text-link" onClick={() => back(0)}>Change</button></div>
          <Field label="Full name" id="claim-name" autoComplete="name" required maxLength={120} value={claim.name} onChange={e => changeClaim('name', e.target.value)} />
          <Field label="Email address" id="claim-email" type="email" autoComplete="email" required value={claim.email} onChange={e => changeClaim('email', e.target.value)} hint="Your gift card is sent here." />
          <details className="optional-fields"><summary>Health card or insurance <small>Optional</small></summary>
            <div className="stack">
              <Field label="Alberta health card number" id="claim-health-card" inputMode="numeric" maxLength={40} value={claim.healthCard} onChange={e => changeClaim('healthCard', e.target.value)} hint="Only clinic staff can see this." />
              <Field label="Insurance company" id="claim-insurance" value={claim.insurance} maxLength={120} onChange={e => changeClaim('insurance', e.target.value)} list={clinic.insurers.length ? 'claim-insurer-options' : undefined} />
              {clinic.insurers.length > 0 && <datalist id="claim-insurer-options">{clinic.insurers.map(i => <option key={i} value={i} />)}</datalist>}
              <Field label="Policy number" id="claim-policy" value={claim.policy} maxLength={120} onChange={e => changeClaim('policy', e.target.value)} hint="Only clinic staff can see this. You can bring your insurance card instead." />
            </div>
          </details>
          <p className="privacy-note">{affiliate?.name} is not told your details. One gift card per email address. Read our <Link href="/privacy">privacy notice</Link> and the <Link href="/gift-card-terms" target="_blank">gift card terms</Link>.</p>
          <div className="honeypot" aria-hidden="true"><label htmlFor="claim-website">Leave this blank</label><input id="claim-website" value={claim.website} onChange={e => changeClaim('website', e.target.value)} tabIndex={-1} autoComplete="off" /></div>
          {!DEMO && <Captcha key={captchaKey} action="claim" onToken={setCaptcha} />}
          <div className="form-actions"><Button type="button" secondary onClick={() => back(0)}>Back</Button><Button disabled={busy} type="submit">{busy ? 'Sending…' : 'Send my gift card'}</Button></div>
        </form>}

        {path === 'claim' && step === 2 && claimed && <div className="confirmation step" key="c2">
          <div className="success-mark"><Icon name="check" size={34} /></div>
          <p className="confirmation-lead">Thank you, {claimed.card.name.split(' ')[0]}. Here is your $50 gift card.</p>
          <Gift affiliate={affiliate} card={claimed.card} />
          <h3 className="plain">How to use it</h3>
          <ul className="check-list">{['Bring your prescription to the clinic.', 'Show this card number, or the email we sent you.', 'We apply the $50 to your eyewear.'].map(t => <li key={t}><Icon name="check" size={18} />{t}</li>)}</ul>
          <Notice>{DEMO ? 'Demo gift card saved in this browser. No email was sent.' : claimed.notifications?.email === 'sent' ? 'Your gift card is on its way to your inbox.' : 'Your gift card is saved. Keep this card number to show at the clinic.'}</Notice>
          <Button secondary href={'/book/' + affiliate.slug}>Return to Eyecon</Button>
        </div>}
      </section>
    </main>
    <Footer />
  </>;
}
