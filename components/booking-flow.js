'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useApp } from './provider';
import DocumentsForm from './documents-form';
import Captcha from './captcha';
import CalendarCard from './calendar-card';
import BookedGift from './booked-gift';
import Image from 'next/image';
import { DEMO, clinic, services, brands, brandFromParam, doctorName, findDoctor, formatDate, instructions, serviceOptions, serviceOptionName } from '@/lib/config';
import { websiteList, offersService, inTimeOff } from '@/lib/schedule';
import { groupByPart, loadDots, nameOk, phoneOk, emailOk, summaryRows, miniSummary } from '@/lib/booking-ui';
import SkinTechnologies from './skin-technologies';
import { BookingReviews } from './reviews';
import { validateBooking, slotTaken } from '@/lib/validation';
import { Header, Footer, Button, Gift, Icon, Notice, Loading } from './ui';

// The round tick on a choice card. It fills and shows a check when the card is chosen.
const Tick = ({ on }) => <span className="bk-tick" aria-hidden="true">{on && <Icon name="check" size={14} />}</span>;

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
        <Tick on={value === d.slug} />
      </label>;
    })}
  </div>;
}

// A details field with an icon, and a green tick once the value looks right.
function IconField({ label, id, icon, ok, hint, ...props }) {
  return <div className="field bk-field">
    <label htmlFor={id}>{label}</label>
    <span className="bk-input"><Icon name={icon} size={18} /><input id={id} aria-describedby={hint ? id + '-hint' : undefined} {...props} />{ok && <span className="bk-ok"><Icon name="check" size={18} /><span className="sr-only">Looks good</span></span>}</span>
    {hint && <small id={id + '-hint'}>{hint}</small>}
  </div>;
}

// The steps across the top. Finished steps can be clicked to go back, until the booking is confirmed.
function Stepper({ labels, step, done, onGo }) {
  return <div className="progress" aria-label={`Step ${step + 1} of ${labels.length}: ${labels[step]}`}>
    <ol className={`stepper bk-stepper ${labels.length === 3 ? 'three' : ''}`}>{labels.map((l, i) => {
      const finished = i < step || done, current = i === step && !done, canGo = i < step && !done;
      return <li key={l} className={finished ? 'done' : ''} aria-current={i === step ? 'step' : undefined}>
        <span className="bk-bar" aria-hidden="true"><span style={{ width: finished ? '100%' : current ? '45%' : '0%' }} /></span>
        <button type="button" disabled={!canGo} onClick={() => onGo(i)}><span className="num">{finished ? <Icon name="check" size={14} /> : i + 1}</span><span className="bk-step-label">{l}</span>{canGo && <span className="sr-only"> (go back to this step)</span>}</button>
      </li>;
    })}</ol>
    <p className="bk-step-now" aria-hidden="true">{done ? 'All done' : `Step ${step + 1} of ${labels.length} · ${labels[step]}`}</p>
  </div>;
}

function SummaryRows({ rows }) {
  return <ul className="bk-summary-rows">{rows.map(r => <li key={r.key} className={r.filled ? 'filled' : ''}>
    <span className="bk-summary-icon" aria-hidden="true"><Icon name={r.icon} size={18} /></span>
    <span><small>{r.label}</small><strong>{r.value}</strong></span>
  </li>)}</ul>;
}

const LABELS = ['Appointment', 'Date and time', 'Your details', 'Confirmed'];
const TITLES = ['What would you like to book?', 'When works for you?', 'Your details', 'You’re booked'];
const SUBTITLES = ['Choose the care you need. It takes about a minute.', '', 'So the clinic can confirm your visit and remind you before it.', ''];
// "Already have a prescription" (affiliate links only): no appointment, just the $50 card emailed to use in store.
const CLAIM_LABELS = ['Choose', 'Your details', 'Gift card ready'];
const CLAIM_TITLES = ['What would you like to book?', 'Where should we send your gift card?', 'Your gift card is ready'];
const CLAIM_SUBTITLES = ['Choose the care you need. It takes about a minute.', 'Bring your prescription to the clinic and use the card on your eyewear.', ''];

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
  const [fileState, setFileState] = useState('form');
  const [service, setService] = useState(params.get('service') || '');
  // An optional choice within the service, such as the skin tightening technology. One passed in the link (from a
  // technology card on the home page) arrives already chosen; unknown slugs are ignored.
  const [serviceOption, setServiceOption] = useState(() => serviceOptions[params.get('service')]?.find(o => o.slug === params.get('option'))?.slug || '');
  const [day, setDay] = useState('');
  const [start, setStart] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const [captcha, setCaptcha] = useState('');
  const [captchaKey, setCaptchaKey] = useState(0);
  // On phones the appointment summary folds into one line above Continue; this opens it.
  const [sheet, setSheet] = useState(false);
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
  const titleRef = useRef(null), firstRender = useRef(true), daysRef = useRef(null);

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
    setSheet(false);
    titleRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step]);

  const dayKey = iso => new Intl.DateTimeFormat('en-CA', { timeZone: clinic.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
  // The times on offer: one optometrist's in doctor mode, everyone's in time mode.
  // Only times with an optometrist who is shown online and performs the chosen service.
  const offered = useMemo(() => slots.filter(s => bookable.some(d => d.slug === s.doctor)), [slots, bookable]);
  const pool = useMemo(() => mode === 'doctor' ? offered.filter(s => s.doctor === doctor) : offered, [offered, mode, doctor]);
  const openCount = useMemo(() => Object.fromEntries(bookable.map(d => [d.slug, offered.filter(s => s.doctor === d.slug).length])), [offered, bookable]);
  // Each day with open times, in order, with how many start times it has (for the dots under the date).
  const days = useMemo(() => {
    const m = new Map();
    for (const s of pool) { const k = dayKey(s.start), d = m.get(k) || { iso: s.start, starts: new Set() }; d.starts.add(s.start); m.set(k, d); }
    return [...m.entries()].map(([key, d]) => [key, d.iso, d.starts.size]);
  }, [pool]);
  // Each start time on the chosen day, with the optometrists free at that moment.
  const times = useMemo(() => { const m = new Map(); for (const s of pool) if (dayKey(s.start) === day) m.set(s.start, [...(m.get(s.start) || []), s.doctor]); return [...m.entries()]; }, [pool, day]);
  const parts = useMemo(() => groupByPart(times, clinic.timezone), [times]);
  const freeAtStart = times.find(([iso]) => iso === start)?.[1] || [];
  const chosenService = services.find(s => s.id === service);
  const chosen = !!(start && doctor && offered.some(s => s.doctor === doctor && s.start === start));

  function change(key, value) { setDetails(d => ({ ...d, [key]: value })); }
  function toggleBrand(b) { setDetails(d => ({ ...d, brands: d.brands.includes(b) ? d.brands.filter(x => x !== b) : [...d.brands, b] })); }
  // In time mode the optometrist follows from the time, so clearing the time clears them too.
  function clearTime(nextDay = '') { setDay(nextDay); setStart(''); if (mode === 'time') setDoctor(''); }
  function switchMode(m) { if (m === mode) return; setError(''); setMode(m); setDay(''); setStart(''); if (m === 'time') setDoctor(''); }
  function pickDoctor(slug) { setError(''); setDoctor(slug); setDay(''); setStart(''); }
  function pickTime(iso, free) { setError(''); setStart(iso); if (mode === 'time') setDoctor(free.length === 1 ? free[0] : ''); }
  function scrollDays(dir) { const el = daysRef.current; if (el) el.scrollBy({ left: dir * el.clientWidth * .8, behavior: 'smooth' }); }
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
  const isClaim = path === 'claim';
  const labels = isClaim ? CLAIM_LABELS : LABELS, titles = isClaim ? CLAIM_TITLES : TITLES, subtitles = isClaim ? CLAIM_SUBTITLES : SUBTITLES;
  const done = step === labels.length - 1;
  const timeText = iso => formatDate(iso, { dateStyle: undefined, timeStyle: 'short' });
  const shortName = slug => { const d = findDoctor(slug); return d ? `${d.title} ${d.last}` : ''; };
  const dayText = (iso, opts) => formatDate(iso, { dateStyle: undefined, timeStyle: undefined, ...opts });
  // After booking, the summary reads from the saved booking: its time is no longer in the open list.
  const booked = confirmation?.booking;
  const when = booked ? formatDate(booked.start, { dateStyle: 'medium', timeStyle: 'short' }) : chosen ? formatDate(start, { dateStyle: 'medium', timeStyle: 'short' }) : '';
  const serviceName = chosenService ? chosenService.name + (optionName ? ' · ' + optionName : '') : '';
  const rows = summaryRows({ claim: isClaim, serviceName, serviceIcon: chosenService?.icon, doctorLabel: booked ? doctorName(booked.doctor) : doctor && (mode === 'doctor' || chosen) ? doctorName(doctor) : '', when, email: claim.email });
  const mini = miniSummary({ claim: isClaim, serviceName, when });
  const first = (confirmation?.booking.name || '').split(' ')[0];
  const title = !isClaim && done && first ? `You’re booked, ${first}` : titles[step];
  // The months the open days cover, first and last only: "October – January".
  const months = [...new Set(days.map(([, iso]) => dayText(iso, { month: 'long' })))];
  const monthSpan = months.length > 1 ? months[0] + ' – ' + months[months.length - 1] : months[0] || '';
  const summary = (action = null) => <div className="selection-summary"><Icon name="calendar" /><div><strong>{chosenService?.name}{optionName && <> · {optionName}</>}</strong><small>With {doctorName(doctor)}</small><small>{formatDate(start, { dateStyle: 'full', timeStyle: 'short' })}</small></div>{action}</div>;

  // Back and Continue. On phones this bar stays at the bottom of the screen, with the appointment so far above it.
  const nav = (backTo, action) => <div className="bk-nav">
    {sheet && <div className="bk-sheet" id="bk-sheet"><strong className="bk-sheet-title">Your appointment</strong><SummaryRows rows={rows} /></div>}
    <button type="button" className="bk-mini" aria-expanded={sheet} aria-controls="bk-sheet" onClick={() => setSheet(o => !o)}>
      <span className={`bk-summary-icon ${isClaim || chosenService ? 'filled' : ''}`} aria-hidden="true"><Icon name={isClaim ? 'gift' : chosenService?.icon || 'calendar'} size={16} /></span>
      <span className="bk-mini-text"><strong>{mini.title}</strong><small>{mini.sub}</small></span>
      <span className="bk-mini-chevron" aria-hidden="true"><Icon name="chevron" size={18} /></span>
      <span className="sr-only">{sheet ? 'Hide' : 'Show'} your appointment</span>
    </button>
    <div className="form-actions">{backTo !== null && <Button type="button" secondary className="bk-back" onClick={() => back(backTo)}><span className="bk-back-icon" aria-hidden="true"><Icon name="chevron" size={18} /></span><span className="bk-back-label">Back</span></Button>}{action}</div>
  </div>;
  const arrow = <span className="bk-arrow" aria-hidden="true"><Icon name="chevron" size={18} /></span>;

  return <>
    <Header bookingHref={affiliate ? '/book/' + affiliate.slug : '/'} bookingLabel="Back to Eyecon" bookingShort="Back" />
    <main className="booking-shell bk" id="main-content">
      <section className="booking-panel">
        {affiliate && <p className="booking-ref"><img src={affiliate.photo || '/images/affiliate.webp'} alt="" width="32" height="32" /><span>Booking through <strong>{affiliate.name}</strong></span>{!done && <span className="bk-pill">$50 gift card</span>}</p>}
        <Stepper labels={labels} step={step} done={done} onGo={back} />
        {done && <div className="success-mark"><Icon name="check" size={34} /></div>}
        <h1 className="bk-title" ref={titleRef} tabIndex={-1}>{title}</h1>
        {subtitles[step] && <p className="bk-sub">{subtitles[step]}</p>}
        {step === 1 && !isClaim && chosenService && <p className="bk-sub">{serviceName}{chosenService.length && <> · {chosenService.length}</>}</p>}
        <Notice error>{error}</Notice>

        {step === 0 && <div className="step" key="s0">
          <div className="service-choices" role="radiogroup" aria-label="Appointment type">
            {/* The prescription card comes first, right under the question, so nobody has to scroll past the services to find it. */}
            {affiliate && <label className={`service-choice prescription-choice ${isClaim ? 'selected' : ''}`}>
              <input type="radio" name="service" value="prescription" checked={isClaim} onChange={() => choose('claim')} />
              <span className="bk-tile shimmer" aria-hidden="true"><Icon name="gift" /></span>
              <span><strong>Already have a prescription?</strong><small>Skip the exam. We’ll email your $50 gift card to use on eyewear in store.</small></span>
              <Tick on={isClaim} />
            </label>}
            {affiliate && <p className="bk-or" aria-hidden="true"><span>Or book a visit</span></p>}
            {services.map((s, i) => { const on = path === 'book' && service === s.id; return <label key={s.id} className={`service-choice ${on ? 'selected' : ''}`} style={{ animationDelay: i * 40 + 'ms' }}>
              <input type="radio" name="service" value={s.id} checked={on} onChange={() => { choose('book'); setService(s.id); if (!serviceOptions[s.id]) setServiceOption(''); }} />
              <span className="bk-tile" aria-hidden="true"><Icon name={s.icon} /></span>
              <span><strong>{s.name}</strong><small>{s.description}</small>{s.length && <small className="bk-length"><Icon name="clock" size={14} />{s.length}</small>}</span>
              <Tick on={on} />
            </label>; })}
          </div>
          {path === 'book' && service === 'skin-tightening' && <SkinTechnologies value={serviceOption} onChange={setServiceOption} />}
          <p className="urgent-note"><Icon name="info" size={18} />Urgent eye concern? {clinic.phone ? <a href={clinic.phoneHref}>Call the clinic</a> : 'Please call the clinic for guidance.'}</p>
          {nav(null, <Button onClick={next} disabled={path === 'book' && !chosenService}>Continue{arrow}</Button>)}
        </div>}

        {path === 'book' && step === 1 && <div className="step" key="s1">
          <div className="mode-toggle" role="group" aria-label="How would you like to choose?">
            {[['doctor', 'Choose a doctor', 'user'], ['time', 'Choose a time', 'clock']].map(([m, label, icon]) => <button type="button" key={m} className={mode === m ? 'active' : ''} aria-pressed={mode === m} onClick={() => switchMode(m)}><Icon name={icon} size={18} />{label}</button>)}
          </div>
          {!slots.length ? <Notice>No online times are available right now. Please call the clinic or check back later.</Notice> : <>
            {mode === 'doctor' && <>
              <p className="time-label"><Icon name="user" size={16} />Your optometrist</p>
              <DoctorChoices name="doctor" label="Optometrist" list={bookable} value={doctor} counts={openCount} onChange={pickDoctor} />
              {!doctor && <p className="quiet">Pick an optometrist to see the days they are available.</p>}
            </>}
            {(mode === 'time' || doctor) && (pool.length ? <>
              <div className="bk-days-head">
                <p className="time-label"><Icon name="calendar" size={16} />{monthSpan}</p>
                <div className="bk-days-arrows"><button type="button" aria-label="Earlier days" onClick={() => scrollDays(-1)}><Icon name="chevron" size={18} /></button><button type="button" aria-label="Later days" onClick={() => scrollDays(1)}><Icon name="chevron" size={18} /></button></div>
              </div>
              <div className="day-grid bk-days" ref={daysRef} role="group" aria-label={mode === 'doctor' ? 'Days ' + doctorName(doctor) + ' is available' : 'Available days'}>
                {days.map(([key, iso, count]) => <button type="button" key={key} className={day === key ? 'active' : ''} aria-pressed={day === key} onClick={() => clearTime(key)} aria-label={`${dayText(iso, { weekday: 'long', month: 'long', day: 'numeric' })}, ${count} open time${count === 1 ? '' : 's'}`}>
                  <small>{dayText(iso, { weekday: 'short' })}</small>
                  <span>{dayText(iso, { day: 'numeric' })}</span>
                  <small>{dayText(iso, { month: 'short' })}</small>
                  <i className="bk-dots" aria-hidden="true">{Array.from({ length: loadDots(count) }, (_, j) => <b key={j} />)}</i>
                </button>)}
              </div>
              {day && parts.map(g => <div className="bk-part" key={mode + day + g.label}>
                <p className="time-label"><Icon name={g.icon} size={16} />{g.label}<small>{g.items.length} open</small></p>
                <div className={`time-grid ${mode === 'time' ? 'with-doctors' : ''}`} role="group" aria-label={g.label + ' times'}>
                  {g.items.map(([iso, free], i) => {
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
              </div>)}
              {!day && <p className="quiet">Pick a day to see the times.</p>}
              {mode === 'time' && start && freeAtStart.length > 1 && <div className="doctor-pick">
                <p className="time-label"><Icon name="users" size={16} />Who would you like to see? {freeAtStart.length} optometrists are free at {timeText(start)}</p>
                <DoctorChoices name="doctor-at-time" label={'Optometrist at ' + timeText(start)} list={bookable.filter(d => freeAtStart.includes(d.slug))} value={doctor} onChange={slug => { setError(''); setDoctor(slug); }} />
              </div>}
            </> : <p className="empty-range">{doctorName(doctor)} has no online times right now. Choose another optometrist, or switch to “Choose a time”.</p>)}
          </>}
          {nav(0, <Button onClick={next} disabled={!chosen}>Continue{arrow}</Button>)}
        </div>}

        {path === 'book' && step === 2 && <div className="step" key="s2">
          <form id="booking-details" onSubmit={submit} className="stack">
            {summary(<button type="button" className="text-link" onClick={() => back(1)}>Change</button>)}
            <IconField label="Full name" id="patient-name" icon="user" ok={nameOk(details.name)} autoComplete="name" required maxLength={120} value={details.name} onChange={e => change('name', e.target.value)} />
            <div className="form-grid">
              <IconField label="Mobile number" id="patient-phone" icon="phone" ok={phoneOk(details.phone)} type="tel" autoComplete="tel" required maxLength={32} placeholder="780 555 0123" value={details.phone} onChange={e => change('phone', e.target.value)} />
              <IconField label="Email address" id="patient-email" icon="mail" ok={emailOk(details.email)} type="email" autoComplete="email" required value={details.email} onChange={e => change('email', e.target.value)} />
            </div>
            <fieldset className="choice-field bk-cards"><legend>Is this your first visit to Eyecon?</legend>
              {['yes', 'no'].map(v => <label key={v}><input type="radio" name="first-visit" required checked={details.firstVisit === v} onChange={() => change('firstVisit', v)} /><span className="bk-tile" aria-hidden="true"><Icon name={v === 'yes' ? 'star' : 'repeat'} size={18} /></span>{v === 'yes' ? 'Yes, first visit' : 'I’ve been before'}</label>)}
            </fieldset>
            <details className="optional-fields"><summary><Icon name="shield" size={18} />Insurance details <small className="bk-recommended">Optional, but highly recommended</small><span className="bk-chevron" aria-hidden="true"><Icon name="chevron" size={18} /></span></summary>
              <div className="stack">
                <IconField label="Insurance company" id="insurance" icon="shield" value={details.insurance} maxLength={120} onChange={e => change('insurance', e.target.value)} list={clinic.insurers.length ? 'insurer-options' : undefined} />
                {clinic.insurers.length > 0 && <datalist id="insurer-options">{clinic.insurers.map(i => <option key={i} value={i} />)}</datalist>}
                <IconField label="Policy number" id="policy" icon="receipt" value={details.policy} maxLength={120} onChange={e => change('policy', e.target.value)} hint="Only clinic staff can see this. You can bring your insurance card instead." />
              </div>
            </details>
            <fieldset className="choice-field brand-field"><legend>Designers you love <small>Choose at least one</small></legend>
              <div className="brand-chips" role="group" aria-label="Favourite designers">
                {brands.map(b => <button type="button" key={b} aria-pressed={details.brands.includes(b)} onClick={() => toggleBrand(b)}>{details.brands.includes(b) && <Icon name="check" size={14} />}{b}</button>)}
              </div>
              <p className="quiet bk-brand-note" aria-live="polite">{details.brands.length ? `${details.brands.length} selected · we’ll have these ready for you to try.` : 'We’ll have these ready for you to try.'}</p>
            </fieldset>
            <label className="checkbox-label bk-switch"><input type="checkbox" role="switch" checked={details.smsConsent} onChange={e => change('smsConsent', e.target.checked)} /><span className="bk-track" aria-hidden="true" /><span>Text me appointment reminders{affiliate ? ' and my gift card details' : ''}.<small>Optional. Message and data rates may apply. Contact the clinic to stop.</small></span></label>
            <p className="privacy-note"><Icon name="lock" size={16} /><span>{affiliate ? `${affiliate.name} can see your name and booking status. Your appointment type and insurance stay with the clinic. ` : ''}Read our <Link href="/privacy">privacy notice</Link>.</span></p>
            <div className="honeypot" aria-hidden="true"><label htmlFor="website">Leave this blank</label><input id="website" value={details.website} onChange={e => change('website', e.target.value)} tabIndex={-1} autoComplete="off" /></div>
            {!DEMO && <Captcha key={captchaKey} action="booking" onToken={setCaptcha} />}
          </form>
          {nav(1, <Button disabled={busy} type="submit" form="booking-details">{busy && <span className="bk-spin" aria-hidden="true" />}{busy ? 'Booking…' : 'Confirm booking'}{!busy && arrow}</Button>)}
        </div>}

        {path === 'book' && step === 3 && confirmation && <div className="confirmation step" key="s3">
          <p className="confirmation-lead">We look forward to seeing you. A confirmation is on its way to your inbox.{affiliate && confirmation.booking.giftCard && <> Your $50 gift card is ready below.</>}</p>
          {/* The file speeds up check-in, so it is the first thing asked for, right under the confirmation. */}
          {confirmation.booking.documentsToken && fileState === 'form' && <a className="file-prompt" href="#complete-file" onClick={e => { e.preventDefault(); const el = document.getElementById('complete-file'); el?.scrollIntoView({ behavior: 'smooth', block: 'start' }); setTimeout(() => el?.querySelector('input')?.focus({ preventScroll: true }), 500); }}>
            <span className="file-prompt-icon" aria-hidden="true"><Icon name="scan" size={22} /></span>
            <span className="file-prompt-text"><strong>One more step: complete your file</strong><small>Add your government ID now and skip the paperwork at check-in. It takes about a minute.</small></span>
            <span className="file-prompt-go">Complete my file <span aria-hidden="true">↓</span></span>
          </a>}
          {confirmation.booking.documentsToken && fileState === 'form' && <p className="file-prompt-skip"><button type="button" className="text-link" onClick={() => setFileState('skipped')}>Skip for now</button> I’ll bring my ID to the visit.</p>}
          <div className="confirmation-card">
            <h3>{services.find(s => s.id === confirmation.booking.service)?.name}</h3>
            {serviceOptionName(confirmation.booking.service, confirmation.booking.serviceOption) && <p>{serviceOptionName(confirmation.booking.service, confirmation.booking.serviceOption)}</p>}
            <p className="ref">Reference<strong>{confirmation.booking.reference}</strong></p>
            <p className="bk-line"><Icon name="calendar" size={18} />{formatDate(confirmation.booking.start, { dateStyle: 'full', timeStyle: 'short' })}</p>
            <p className="bk-line"><Icon name="user" size={18} />With {doctorName(confirmation.booking.doctor)}</p>
            <p className="bk-line muted"><Icon name="pin" size={18} />{clinic.address || 'The clinic will confirm the location with you.'}</p>
            <CalendarCard booking={confirmation.booking} compact />
            {affiliate && confirmation.booking.giftCard && <BookedGift affiliate={affiliate} card={confirmation.booking.giftCard} emailed={confirmation.notifications?.email} email={confirmation.booking.email} />}
          </div>

          <DocumentsForm token={confirmation.booking.documentsToken} canSkip onState={setFileState} skip={fileState === 'skipped'} />

          <div className="bk-before">
            <h3 className="plain">Before your visit</h3>
            <ul className="check-list">{instructions.map(t => <li key={t}><span className="bk-tile" aria-hidden="true"><Icon name="check" size={16} /></span>{t}</li>)}</ul>
          </div>
          <Notice>{DEMO ? 'Demo booking saved in this browser. No email or SMS was sent.' : confirmation.notifications?.email === 'sent' ? 'Your confirmation email is on its way. Check your inbox.' : 'Your booking is saved. Keep your reference and add it to your calendar above.'}</Notice>
          <Button secondary href={affiliate ? '/book/' + affiliate.slug : '/'}>Return to Eyecon</Button>
        </div>}

        {isClaim && step === 1 && <div className="step" key="c1">
          <form id="claim-details" onSubmit={submitClaim} className="stack">
            <div className="selection-summary"><Icon name="gift" /><div><strong>Already have a prescription</strong><small>We’ll email your $50 gift card. Bring your prescription to the clinic and use the card on your eyewear.</small></div><button type="button" className="text-link" onClick={() => back(0)}>Change</button></div>
            <IconField label="Full name" id="claim-name" icon="user" ok={nameOk(claim.name)} autoComplete="name" required maxLength={120} value={claim.name} onChange={e => changeClaim('name', e.target.value)} />
            <IconField label="Email address" id="claim-email" icon="mail" ok={emailOk(claim.email)} type="email" autoComplete="email" required value={claim.email} onChange={e => changeClaim('email', e.target.value)} hint="Your gift card is sent here." />
            <details className="optional-fields"><summary><Icon name="shield" size={18} />Health card or insurance <small>Optional</small><span className="bk-chevron" aria-hidden="true"><Icon name="chevron" size={18} /></span></summary>
              <div className="stack">
                <IconField label="Alberta health card number" id="claim-health-card" icon="receipt" inputMode="numeric" maxLength={40} value={claim.healthCard} onChange={e => changeClaim('healthCard', e.target.value)} hint="Only clinic staff can see this." />
                <IconField label="Insurance company" id="claim-insurance" icon="shield" value={claim.insurance} maxLength={120} onChange={e => changeClaim('insurance', e.target.value)} list={clinic.insurers.length ? 'claim-insurer-options' : undefined} />
                {clinic.insurers.length > 0 && <datalist id="claim-insurer-options">{clinic.insurers.map(i => <option key={i} value={i} />)}</datalist>}
                <IconField label="Policy number" id="claim-policy" icon="receipt" value={claim.policy} maxLength={120} onChange={e => changeClaim('policy', e.target.value)} hint="Only clinic staff can see this. You can bring your insurance card instead." />
              </div>
            </details>
            <p className="privacy-note"><Icon name="lock" size={16} /><span>{affiliate?.name} is not told your details. One gift card per email address. Read our <Link href="/privacy">privacy notice</Link> and the <Link href="/gift-card-terms" target="_blank">gift card terms</Link>.</span></p>
            <div className="honeypot" aria-hidden="true"><label htmlFor="claim-website">Leave this blank</label><input id="claim-website" value={claim.website} onChange={e => changeClaim('website', e.target.value)} tabIndex={-1} autoComplete="off" /></div>
            {!DEMO && <Captcha key={captchaKey} action="claim" onToken={setCaptcha} />}
          </form>
          {nav(0, <Button disabled={busy} type="submit" form="claim-details">{busy && <span className="bk-spin" aria-hidden="true" />}{busy ? 'Sending…' : 'Send my gift card'}{!busy && arrow}</Button>)}
        </div>}

        {isClaim && step === 2 && claimed && <div className="confirmation step" key="c2">
          <p className="confirmation-lead">Thank you, {claimed.card.name.split(' ')[0]}. Here is your $50 gift card.</p>
          <Gift affiliate={affiliate} card={claimed.card} />
          <div className="bk-before">
            <h3 className="plain">How to use it</h3>
            <ul className="check-list">{['Bring your prescription to the clinic.', 'Show this card number, or the email we sent you.', 'We apply the $50 to your eyewear.'].map(t => <li key={t}><span className="bk-tile" aria-hidden="true"><Icon name="check" size={16} /></span>{t}</li>)}</ul>
          </div>
          <Notice>{DEMO ? 'Demo gift card saved in this browser. No email was sent.' : claimed.notifications?.email === 'sent' ? 'Your gift card is on its way to your inbox.' : 'Your gift card is saved. Keep this card number to show at the clinic.'}</Notice>
          <Button secondary href={'/book/' + affiliate.slug}>Return to Eyecon</Button>
        </div>}
      </section>

      <aside className="booking-aside" aria-label="Your appointment">
        <div className="bk-summary">
          <div className="bk-summary-head"><strong>Your appointment</strong>{done && <span className="bk-badge">Confirmed</span>}</div>
          <SummaryRows rows={rows} />
        </div>
        {affiliate && !done && <Gift compact affiliate={affiliate} />}
        <div className="booking-help">
          <Icon name="phone" />
          <h3>Prefer to talk to us?</h3>
          {clinic.phone ? <a href={clinic.phoneHref}>{clinic.phone}</a> : <p>The clinic phone number will be added before launch.</p>}
        </div>
        <BookingReviews />
      </aside>
    </main>
    <Footer />
  </>;
}
