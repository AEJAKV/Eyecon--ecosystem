'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useApp } from './provider';
import QR from './qr';
import { Header, Footer, Button, Field, Notice, Icon } from './ui';
import { parseGiftNumber, giftCardPath } from '@/lib/gift';
import { clinic, doctorName, formatDate, services } from '@/lib/config';

// Staff see the card's state as a word, not only a colour.
function state(card) {
  if (card.status === 'Redeemed') return { label: 'Already redeemed', tone: 'cancelled' };
  if (card.status === 'Void') return { label: 'Void', tone: 'cancelled' };
  if (card.expired) return { label: 'Expired', tone: 'cancelled' };
  return { label: 'Valid', tone: 'attended' };
}

// What signed-in staff see under the card: is it valid, and whose is it. A booking card shows the appointment; a
// prescription card has none.
function StaffView({ number }) {
  const { scanGift } = useApp();
  const [card, setCard] = useState(null), [error, setError] = useState(''), [loading, setLoading] = useState(true);
  useEffect(() => {
    let live = true; setLoading(true); setError('');
    scanGift(number).then(c => { if (live) setCard(c); }).catch(e => { if (live) setError(e.message); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [number]);
  if (loading) return <p className="quiet" role="status">Checking this card…</p>;
  if (error) return <Notice error>{error}</Notice>;
  const s = state(card), b = card.booking;
  return <div className="scan-result">
    <div className="scan-head"><span className={'badge ' + s.tone}>{s.label}</span><small>{card.kind === 'booking' ? 'Booked an appointment' : 'Already has a prescription'}</small></div>
    <dl className="scan-fields">
      <div><dt>Name</dt><dd>{card.name}</dd></div>
      <div><dt>Email</dt><dd>{card.email}</dd></div>
      <div><dt>Card number</dt><dd className="mono">{card.number}</dd></div>
      <div><dt>Valid until</dt><dd>{formatDate(card.expiresAt, { dateStyle: 'medium', timeStyle: undefined })}</dd></div>
      {b && <>
        <div><dt>Booking reference</dt><dd className="mono">{b.reference || '—'}</dd></div>
        <div><dt>Appointment</dt><dd>{services.find(x => x.id === b.service)?.name || b.service}</dd></div>
        <div><dt>Optometrist</dt><dd>{doctorName(b.doctor) || '—'}</dd></div>
        <div><dt>Date and time</dt><dd>{formatDate(b.start, { dateStyle: 'full', timeStyle: 'short' })}</dd></div>
        <div><dt>Booking status</dt><dd>{b.status}</dd></div>
      </>}
    </dl>
    {!b && <p className="quiet">No appointment: this patient claimed the card with an existing prescription.</p>}
  </div>;
}

function CheckAnother() {
  const router = useRouter(), [value, setValue] = useState(''), [error, setError] = useState('');
  function go(e) { e.preventDefault(); const serial = parseGiftNumber(value); if (!serial) { setError('Enter a card number such as EYC-AMO-7K2M9Q, or its last six characters.'); return; } setError(''); router.push(giftCardPath(value.trim().toUpperCase())); }
  return <form className="scan-another" onSubmit={go}>
    <Field label="Check another card" id="scan-number" value={value} onChange={e => setValue(e.target.value)} placeholder="EYC-AMO-7K2M9Q" autoComplete="off" error={error} />
    <Button type="submit" secondary>Check</Button>
  </form>;
}

export default function GiftCardPage({ number }) {
  const { user, ready } = useApp();
  const [origin, setOrigin] = useState('');
  useEffect(() => { setOrigin(window.location.origin); }, []);
  const serial = parseGiftNumber(number), shown = String(number).toUpperCase();
  const staff = ready && user?.role === 'staff';
  return <>
    <Header />
    <main className="container gift-page" id="main-content">
      {!serial
        ? <><h1>Gift card</h1><Notice error>This is not an Eyecon gift card number. Please check the link in your email.</Notice></>
        : <>
          <section className="gift-card-face" aria-labelledby="gift-card-title">
            <p className="eyebrow">EYECON OPTOMETRY</p>
            <h1 id="gift-card-title"><span className="gift-value">$50</span> gift card</h1>
            {origin ? <QR url={origin + giftCardPath(shown)} size={200} className="gift-qr" alt={'QR code for gift card ' + shown} /> : <div className="gift-qr" style={{ width: 200, height: 200 }} />}
            <p className="gift-number"><span className="sr-only">Card number </span>{shown}</p>
            <p className="quiet">Show this code at the clinic. {clinic.address || ''}</p>
            <Link className="gift-terms" href="/gift-card-terms">Gift card terms</Link>
          </section>
          <section className="scan-panel" aria-label="Clinic staff">
            {staff
              ? <><h2><Icon name="check" size={20} /> Staff check</h2><StaffView number={shown} /><CheckAnother /></>
              : <p className="quiet">Clinic staff: <Link href={'/login?next=' + encodeURIComponent(giftCardPath(shown))}>sign in</Link> to see whose card this is.</p>}
          </section>
        </>}
    </main>
    <Footer />
  </>;
}
