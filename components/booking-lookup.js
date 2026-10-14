'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useApp } from './provider';
import Captcha from './captcha';
import CalendarCard from './calendar-card';
import { DEMO, clinic, formatDate } from '@/lib/config';
import { Header, Footer, Button, Field, Icon, Notice, Loading } from './ui';

// /my-booking: patients without an account find their booking with its reference and the email they booked with.
// The result is the limited view from lib/lookup.js; changes go through the clinic by phone.
export default function BookingLookup() {
  const { ready, lookupBooking } = useApp();
  const [form, setForm] = useState({ reference: '', email: '', website: '' });
  const [captcha, setCaptcha] = useState(''), [captchaKey, setCaptchaKey] = useState(0);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [booking, setBooking] = useState(null);
  const change = (key, value) => setForm(f => ({ ...f, [key]: value }));

  async function submit(e) {
    e.preventDefault(); setError(''); setBusy(true);
    try {
      if (!DEMO && !captcha) throw new Error('Complete the verification first.');
      const result = await lookupBooking({ ...form, captcha });
      setBooking(result.booking);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); setCaptcha(''); setCaptchaKey(k => k + 1); }
  }

  if (!ready) return <Loading />;
  const upcoming = booking && booking.status === 'Booked' && new Date(booking.start) > new Date();
  const call = clinic.phone ? <a href={'tel:' + clinic.phone}>{clinic.phone}</a> : 'the clinic';
  return <>
    <Header />
    <main className="container lookup-page" id="main-content">
      <p className="eyebrow">YOUR APPOINTMENT</p>
      <h1>Find my booking</h1>
      {!booking ? <>
        <p className="muted">Enter the booking reference from your confirmation and the email address you booked with.</p>
        {DEMO && <p className="demo-label">Demo: this searches the sample bookings saved in this browser. Try reference 7K2M9QXB with sample1@example.com.</p>}
        <Notice error>{error}</Notice>
        <form className="stack lookup-form" onSubmit={submit}>
          <Field label="Booking reference" id="lookup-reference" required maxLength={12} autoComplete="off" autoCapitalize="characters" spellCheck={false} placeholder="7K2M9QXB" value={form.reference} onChange={e => change('reference', e.target.value)} hint="8 letters and numbers, in your confirmation email." />
          <Field label="Email address" id="lookup-email" type="email" autoComplete="email" required value={form.email} onChange={e => change('email', e.target.value)} />
          <div className="honeypot" aria-hidden="true"><label htmlFor="lookup-website">Leave this blank</label><input id="lookup-website" value={form.website} onChange={e => change('website', e.target.value)} tabIndex={-1} autoComplete="off" /></div>
          {!DEMO && <Captcha key={captchaKey} action="lookup" onToken={setCaptcha} />}
          <div className="form-actions"><Button type="submit" disabled={busy}>{busy ? 'Finding…' : 'Find my booking'}</Button></div>
        </form>
      </> : <div className="lookup-result">
        <div className="confirmation-card">
          <h3>{booking.serviceName}</h3>
          <p className="ref">Reference<strong>{booking.reference}</strong></p>
          {booking.doctorName && <p>With {booking.doctorName}</p>}
          <p>{formatDate(booking.start, { dateStyle: 'full', timeStyle: 'short' })} · {booking.duration} min</p>
          <p className="muted">{booking.clinicAddress || 'The clinic will confirm the location with you.'}</p>
          {booking.status !== 'Booked' && <p><span className={'badge ' + booking.status.toLowerCase()}>{booking.status}</span></p>}
        </div>
        {booking.giftCardNumber && <p className="lookup-line"><Icon name="gift" size={20} /><span>Gift card number <strong>{booking.giftCardNumber}</strong>. Please bring it to your visit.</span></p>}
        {booking.fileComplete
          ? <p className="lookup-line"><Icon name="check" size={20} /><span>Your file is complete.</span></p>
          : booking.documentsToken && <p className="lookup-line"><Icon name="scan" size={20} /><span>Your file is missing a government ID. <Link href={'/documents#t=' + booking.documentsToken}>Complete your file</Link></span></p>}
        {upcoming && <CalendarCard booking={booking} text="One tap, so you won’t miss it." />}
        <p className="lookup-line"><Icon name="phone" size={20} /><span>To change or cancel this appointment, please call {call}.</span></p>
        <Button secondary onClick={() => { setBooking(null); setForm({ reference: '', email: '', website: '' }); }}>Find another booking</Button>
      </div>}
    </main>
    <Footer />
  </>;
}
