'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useApp } from './provider';
import QR from './qr';
import { Header, Footer, Button, Field, Notice, Icon } from './ui';
import { parseGiftNumber, giftCardPath, giftState } from '@/lib/gift';
import { RedeemGift } from './gift-status';
import { downloadGiftCard } from './gift-download';
import { clinic, doctorName, formatDate, services } from '@/lib/config';
import { isClinic } from '@/lib/front-desk';

// Staff see the card's state as a word, not only a colour. A card that can still be used reads "Valid".
function state(card) {
  const s = giftState(card);
  return s === 'Not redeemed' ? { label: 'Valid · not redeemed', tone: 'attended' } : { label: s === 'Redeemed' ? 'Already redeemed' : s, tone: 'cancelled' };
}

// What signed-in staff see under the card: is it valid, and whose is it. A booking card shows the appointment; a
// prescription card has none.
function StaffView({ number }) {
  const { scanGift, data } = useApp();
  const [card, setCard] = useState(null), [error, setError] = useState(''), [loading, setLoading] = useState(true);
  useEffect(() => { setLoading(true); setCard(null); }, [number]);
  // Checked again whenever the workspace data changes, so a redemption shows straight away.
  useEffect(() => {
    let live = true;
    scanGift(number).then(c => { if (live) { setCard(c); setError(''); } }).catch(e => { if (live) setError(e.message); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [number, data]);
  if (loading) return <p className="quiet" role="status">Checking this card…</p>;
  if (error && !card) return <Notice error>{error}</Notice>;
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
    <RedeemGift number={card.number} card={card} />
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

// The card itself. Only a card that can still be used shows its QR code; a redeemed, expired or void card shows a
// stamp instead, so nobody tries to use it again. If the status cannot be checked (offline), the code is shown and staff
// still see the real state when they scan it.
function CardFace({ shown, status, origin }) {
  const until = d => formatDate(d, { dateStyle: 'long', timeStyle: undefined });
  const s = status.card?.state, usable = !status.loading && !status.missing && (!status.card || s === 'Not redeemed');
  return <section className={`gift-card-face ${usable || status.loading ? '' : 'used'}`} aria-labelledby="gift-card-title">
    <p className="eyebrow">EYECON OPTOMETRY</p>
    <h1 id="gift-card-title"><span className="gift-value">$50</span> gift card</h1>
    {status.loading
      ? <div className="gift-qr" style={{ width: 200, height: 200 }} aria-label="Checking this card" />
      : status.missing
        ? <p className="gift-stamp-text">We could not find this gift card. Please check the link in your email, or call the clinic.</p>
        : usable
          ? (origin ? <QR url={origin + giftCardPath(shown)} size={200} className="gift-qr" alt={'QR code for gift card ' + shown} /> : <div className="gift-qr" style={{ width: 200, height: 200 }} />)
          : <div className="gift-stamp" role="img" aria-label={'Gift card ' + s.toLowerCase()}><span>{s}</span></div>}
    {!status.missing && <p className="gift-number"><span className="sr-only">Card number </span>{shown}</p>}
    {!status.loading && !status.missing && <p className="gift-stamp-text">{
      s === 'Redeemed' ? <>This card was used{status.card.redeemedAt ? <> on {until(status.card.redeemedAt)}</> : null}. It cannot be used again.</>
        : s === 'Expired' ? <>This card expired on {until(status.card.expiresAt)}.</>
          : s === 'Void' ? <>This card is no longer valid. Please call the clinic.</>
            : <>{status.card ? <>Valid until {until(status.card.expiresAt)}. </> : null}Show this code at the clinic. {clinic.address || ''}</>}</p>}
    {usable && origin && <button type="button" className="text-link gift-save" onClick={() => downloadGiftCard({ number: shown, url: origin + giftCardPath(shown), expiresAt: status.card?.expiresAt })}>Download card</button>}
    <Link className="gift-terms" href="/gift-card-terms">Gift card terms</Link>
  </section>;
}

export default function GiftCardPage({ number }) {
  const { user, ready, giftStatus, data } = useApp();
  const [origin, setOrigin] = useState('');
  useEffect(() => { setOrigin(window.location.origin); }, []);
  const serial = parseGiftNumber(number), shown = String(number).toUpperCase();
  const staff = ready && isClinic(user);
  // Checked again when the workspace data changes, so a card staff have just redeemed shows as used straight away.
  const [status, setStatus] = useState({ loading: true });
  useEffect(() => {
    if (!serial || !ready) return;
    let live = true;
    giftStatus(shown).then(card => { if (live) setStatus(card ? { card } : { missing: true }); }).catch(() => { if (live) setStatus({ failed: true }); });
    return () => { live = false; };
  }, [shown, ready, data]);
  return <>
    <Header />
    <main className="container gift-page" id="main-content">
      {!serial
        ? <><h1>Gift card</h1><Notice error>This is not an Eyecon gift card number. Please check the link in your email.</Notice></>
        : <>
          <CardFace shown={shown} status={status} origin={origin} />
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
