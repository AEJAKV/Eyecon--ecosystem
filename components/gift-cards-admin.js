'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, Field, Empty } from './ui';
import { giftCardRows, parseGiftNumber, giftCardPath } from '@/lib/gift';
import { formatDate } from '@/lib/config';

const TONES = { 'Redeemed': 'attended', 'Not redeemed': 'gift-open', 'Expired': 'no-show', 'Void': 'no-show' };
const day = d => d ? formatDate(d, { dateStyle: 'medium', timeStyle: undefined }) : '—';

// Staff › Gift cards: check a card by number (opens its page, where it can be redeemed) and every card issued, booking
// and prescription, with its state.
export default function GiftCardsAdmin({ data }) {
  const router = useRouter();
  const [number, setNumber] = useState(''), [error, setError] = useState(''), [query, setQuery] = useState(''), [state, setState] = useState('All');
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
    {shown.length ? <div className="table-wrap" tabIndex={0} role="region" aria-label="Gift cards table"><table>
      <caption className="sr-only">Gift cards</caption>
      <thead><tr><th scope="col">Card</th><th scope="col">Patient</th><th scope="col">Type</th><th scope="col">Issued</th><th scope="col">Valid until</th><th scope="col">Status</th></tr></thead>
      <tbody>{shown.map(r => <tr key={r.id}>
        <td><Link className="mono" href={giftCardPath(r.number)}>{r.number}</Link></td>
        <td><strong>{r.name}</strong><small>{r.email}</small></td>
        <td>{r.kind === 'Booking' ? 'Booking' : 'Prescription'}{r.reference && <small>Ref {r.reference}</small>}{r.introducer && <small>Via {r.introducer}</small>}</td>
        <td>{day(r.issuedAt)}</td>
        <td>{day(r.expiresAt)}</td>
        <td><span className={'badge ' + TONES[r.state]}>{r.state}</span>{r.redeemedAt && <small>{day(r.redeemedAt)}</small>}</td>
      </tr>)}</tbody>
    </table></div> : <Empty text={rows.length ? 'No gift cards match your filters.' : 'No gift cards yet. Cards are issued when someone books through an affiliate link or claims one with a prescription.'} />}
  </>;
}
