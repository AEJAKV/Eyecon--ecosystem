'use client';
import { useEffect, useState } from 'react';
import QR from './qr';
import { Button } from './ui';
import { downloadGiftCard } from './gift-download';
import { giftNumber, giftCardPath } from '@/lib/gift';
import { formatDate } from '@/lib/config';

// The gift card inside the "You're booked" tile: what it is, the QR code with the card number under it, and a
// Download button. Text beside the code on wide screens, stacked on phones. emailed is the gift email's status: 'sent'
// says it is in their inbox (Download stays as a backup); otherwise Download is the way to keep it.
export default function BookedGift({ affiliate, card, emailed, email }) {
  const [origin, setOrigin] = useState(''), [busy, setBusy] = useState(false);
  useEffect(() => { setOrigin(window.location.origin); }, []);
  const number = giftNumber(affiliate, card.serial), url = origin + giftCardPath(number);
  async function download() { setBusy(true); try { await downloadGiftCard({ number, url, expiresAt: card.expiresAt }); } finally { setBusy(false); } }
  return <section className="booked-gift" aria-labelledby="booked-gift-title">
    <div className="booked-gift-text">
      <h4 id="booked-gift-title">{emailed === 'sent' ? 'Your gift card is in your inbox' : 'Download your gift card'}</h4>
      <p><strong className="booked-gift-value">$50</strong> toward your eyewear, courtesy of {affiliate.name}.</p>
      <p className="quiet">Valid until {formatDate(card.expiresAt, { dateStyle: 'medium', timeStyle: undefined })}. Show the code at the clinic. <a className="gift-terms" href="/gift-card-terms" target="_blank">Terms</a></p>
      {emailed === 'sent' ? <p className="booked-gift-mail">We emailed it to <strong>{email}</strong>. It’s in your confirmation email, attached so you can save it to your phone. Not there? Check your spam folder, or download it here.</p>
        : emailed === 'demo' ? <p className="booked-gift-mail">On the live site, this card is also in the confirmation email, attached to save.</p> : null}
      <Button secondary={emailed === 'sent'} onClick={download} disabled={!origin || busy}>{busy ? 'Preparing…' : 'Download gift card'}</Button>
    </div>
    <figure className="booked-gift-code">
      {origin ? <QR url={url} size={132} className="gift-qr" alt={'QR code for gift card ' + number} /> : <div className="gift-qr" style={{ width: 132, height: 132 }} />}
      <figcaption className="gift-number"><span className="sr-only">Card number </span>{number}</figcaption>
    </figure>
  </section>;
}
