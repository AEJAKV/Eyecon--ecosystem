'use client';
import { useState } from 'react';
import { useApp } from './provider';
import { giftState } from '@/lib/gift';
import { formatDate } from '@/lib/config';
import { Button, Notice } from './ui';

const TONES = { 'Redeemed': 'attended', 'Not redeemed': 'gift-open', 'Expired': 'no-show', 'Void': 'no-show' };
// A booking's gift card state in the staff bookings list: "Gift card: Not redeemed", "Redeemed" or "Expired".
export function GiftBadge({ card }) {
  const label = giftState(card);
  return <span className={'badge file-badge gift-badge ' + TONES[label]}>Gift card: {label}</span>;
}

// Staff mark a gift card redeemed when the patient uses it in store, or undo a mistake. number is the full card number
// (EYC-AMO-7K2M9Q); card is { status, expiresAt, redeemedAt }. onDone runs after a change (for example to re-check).
export function RedeemGift({ number, card, onDone }) {
  const { action } = useApp();
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [done, setDone] = useState('');
  const label = giftState(card);
  async function change(redeemed) {
    setBusy(true); setError(''); setDone('');
    try { await action('gift-redeem', { number, redeemed }); setDone(redeemed ? 'Gift card marked as redeemed.' : 'Redemption undone. The card can be used again.'); await onDone?.(); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  return <div className="redeem-gift">
    {label === 'Redeemed'
      ? <p className="redeem-line"><span className="badge attended">Redeemed</span>{card.redeemedAt && <span>{formatDate(card.redeemedAt)}</span>}<button type="button" className="text-link" disabled={busy} onClick={() => change(false)}>Undo<span className="sr-only"> redemption of gift card {number}</span></button></p>
      : label === 'Not redeemed'
        ? <Button disabled={busy} onClick={() => change(true)}>{busy ? 'Saving…' : 'Mark gift card as redeemed'}</Button>
        : <p className="quiet">This card is {label.toLowerCase()} and cannot be redeemed.</p>}
    <Notice error>{error}</Notice>
    <Notice>{done}</Notice>
  </div>;
}
