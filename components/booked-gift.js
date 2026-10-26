'use client';
import { useEffect, useState } from 'react';
import QR from './qr';
import { Button } from './ui';
import { downloadGiftCard } from './gift-download';
import { giftNumber, giftCardPath } from '@/lib/gift';
import { formatDate } from '@/lib/config';

// The gift card inside the "You're booked" tile: what it is, the QR code with the card number under it, and a
// Download button. Text beside the code on wide screens, stacked on phones.
export default function BookedGift({ affiliate, card }) {
  const [origin, setOrigin] = useState(''), [busy, setBusy] = useState(false);
  useEffect(() => { setOrigin(window.location.origin); }, []);
  const number = giftNumber(affiliate, card.serial), url = origin + giftCardPath(number);
  async function download() { setBusy(true); try { await downloadGiftCard({ number, url, expiresAt: card.expiresAt }); } finally { setBusy(false); } }
  return <section className="booked-gift" aria-labelledby="booked-gift-title">
    <div className="booked-gift-text">
      <h4 id="booked-gift-title">Download your gift card</h4>
      <p><strong className="booked-gift-value">$50</strong> toward your eyewear, courtesy of {affiliate.name}.</p>
      <p className="quiet">Valid until {formatDate(card.expiresAt, { dateStyle: 'medium', timeStyle: undefined })}. Show the code at the clinic. <a className="gift-terms" href="/gift-card-terms" target="_blank">Terms</a></p>
      <Button onClick={download} disabled={!origin || busy}>{busy ? 'Preparing…' : 'Download gift card'}</Button>
    </div>
    <figure className="booked-gift-code">
      {origin ? <QR url={url} size={132} className="gift-qr" alt={'QR code for gift card ' + number} /> : <div className="gift-qr" style={{ width: 132, height: 132 }} />}
      <figcaption className="gift-number"><span className="sr-only">Card number </span>{number}</figcaption>
    </figure>
  </section>;
}
