'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, Field, Empty, Notice } from './ui';
import { useApp } from './provider';
import { giftCardRows, parseGiftNumber, giftCardPath } from '@/lib/gift';
import { formatDate } from '@/lib/config';

const TONES = { 'Redeemed': 'attended', 'Not redeemed': 'gift-open', 'Expired': 'no-show', 'Void': 'no-show' };
const day = d => d ? formatDate(d, { dateStyle: 'medium', timeStyle: undefined }) : '—';

// Staff › Gift cards: check a card by number (opens its page, where it can be redeemed) and every card issued, booking
// and prescription, with its state.
export default function GiftCardsAdmin({ data, fresh = new Set() }) {
  const router = useRouter();
  const [done, setDone] = useState(''), [number, setNumber] = useState(''), [error, setError] = useState(''), [query, setQuery] = useState(''), [state, setState] = useState('All');
  const rows = useMemo(() => giftCardRows(data), [data]);
  const shown = rows.filter(r => (state === 'All' || r.state === state) && (!query || (r.name + ' ' + r.number + ' ' + r.email).toLowerCase().includes(query.toLowerCase())));
  function check(e) {
    e.preventDefault();
    const serial = parseGiftNumber(number);
    if (!serial) { setError('Enter a card number such as EYC-AMO-7K2M9Q, or its last six characters.'); return; }
    const match = rows.find(r => r.number.endsWith('-' + serial));
    router.push(giftCardPath(match ? match.number : number.trim().toUpperCase()));
  }
  return <>
    {/* The hint and any error sit under the row, so the button lines up with the input box. */}
    <form className="gift-check" onSubmit={check} noValidate>
      <div className="gift-check-row">
        <Field label="Check a card number" id="gift-check" value={number} onChange={e => { setError(''); setNumber(e.target.value); }} placeholder="EYC-AMO-7K2M9Q" autoComplete="off" aria-invalid={!!error} aria-describedby="gift-check-help" />
        <Button type="submit">Check card</Button>
      </div>
      <p id="gift-check-help" className={error ? 'error-text' : 'quiet'}>{error || 'Or scan the patient’s QR code with your phone camera while signed in.'}</p>
    </form>
    <div className="filters">
      <Field label="Search cards" id="gift-search" type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Name, email or card number" />
      <Field label="Status" id="gift-state"><select id="gift-state" value={state} onChange={e => setState(e.target.value)}>{['All', 'Not redeemed', 'Redeemed', 'Expired'].map(s => <option key={s}>{s}</option>)}</select></Field>
    </div>
    <Notice>{done}</Notice>
    {shown.length ? <div className="table-wrap card-table" tabIndex={0} role="region" aria-label="Gift cards table"><table>
      <caption className="sr-only">Gift cards</caption>
      <thead><tr><th scope="col">Card</th><th scope="col">Patient</th><th scope="col">Type</th><th scope="col">Issued</th><th scope="col">Valid until</th><th scope="col">Status</th></tr></thead>
      <tbody>{shown.map(r => <tr key={r.id} className={fresh.has(r.id) ? 'is-new' : undefined}>
        <td data-label="Card" data-main="">{fresh.has(r.id) && <span className="new-dot" aria-hidden="true" />}<Link className="mono" href={giftCardPath(r.number)}>{r.number}</Link>{fresh.has(r.id) && <span className="new-tag">New</span>}</td>
        <td data-label="Patient"><strong>{r.name}</strong><small>{r.email}</small></td>
        <td data-label="Type">{r.kind === 'Booking' ? 'Booking' : 'Prescription'}{r.reference && <small>Ref {r.reference}</small>}{r.introducer && <small>Via {r.introducer}</small>}</td>
        <td data-label="Issued">{day(r.issuedAt)}</td>
        <td data-label="Valid until">{day(r.expiresAt)}</td>
        <td data-label="Status"><span className={'badge ' + TONES[r.state]}>{r.state}</span>{r.redeemedAt && <small>{day(r.redeemedAt)}</small>}<RedeemControl row={r} onDone={setDone} /></td>
      </tr>)}</tbody>
    </table></div> : <Empty text={rows.length ? 'No gift cards match your filters.' : 'No gift cards yet. Cards are issued when someone books through an affiliate link or claims one with a prescription.'} />}
  </>;
}

// Redeem (or undo) straight from the list, for convenience. Always asks to confirm, naming the card and the patient,
// so the wrong row can't be redeemed by a stray click. Uses the same 'gift-redeem' action as the card's own page:
// a card is used once, expired cards are refused, and every redeem and undo is logged.
export function RedeemControl({ row, onDone }) {
  const { action } = useApp(), [asking, setAsking] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const redeem = row.state === 'Not redeemed', undo = row.state === 'Redeemed';
  if (!redeem && !undo) return null;
  async function confirm() {
    setBusy(true); setError('');
    try { await action('gift-redeem', { number: row.number, redeemed: redeem }); setAsking(false); onDone?.(redeem ? `${row.number} marked as redeemed for ${row.name}.` : `Redemption undone for ${row.number}. The card can be used again.`); }
    catch (e) { setError(e.message || 'Could not update this gift card.'); }
    finally { setBusy(false); }
  }
  if (!asking) return <button type="button" className={redeem ? 'mini-button redeem-button' : 'text-link redeem-undo'} onClick={() => { setError(''); setAsking(true); }}>{redeem ? 'Mark as redeemed' : 'Undo redemption'}<span className="sr-only"> {row.number} for {row.name}</span></button>;
  return <div className="redeem-confirm" role="alert">
    <p>{redeem ? <>Mark <strong>{row.number}</strong> as redeemed for {row.name}? Do this once they’ve used it on their purchase.</> : <>Undo the redemption of <strong>{row.number}</strong>? The card can then be used again.</>}</p>
    {error && <p className="error-text">{error}</p>}
    <div className="redeem-actions"><button type="button" className="mini-button redeem-button" disabled={busy} onClick={confirm}>{busy ? 'Saving…' : redeem ? 'Yes, mark redeemed' : 'Yes, undo'}</button><button type="button" className="text-link" disabled={busy} onClick={() => setAsking(false)}>Cancel</button></div>
  </div>;
}
