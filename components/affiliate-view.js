'use client';
import { formatDate, money } from '@/lib/config';
import { completed, affiliateStats } from '@/lib/affiliate';
import { Empty } from './ui';

// The affiliate's overview figures. Upcoming bookings are a count only and never add to the completed figures.
export function AffiliateStats({ rows }) {
  const st = affiliateStats(rows);
  return <div className="stats">{[['Completed referrals', st.completedThisMonth, 'This month · ' + st.completedAllTime + ' all time'], ['Upcoming bookings', st.upcoming, 'Counts once completed'], ['Commission earned', money(st.earned), 'From completed referrals'], ['Paid', money(st.paid), st.awaitingPayment > 0 ? money(st.awaitingPayment) + ' awaiting payment' : 'Nothing awaiting payment']].map(([label, value, note]) => <article key={label}><p>{label}</p><strong>{value}</strong><small>{note}</small></article>)}</div>;
}
// An affiliate's referrals: patient, appointment date, status and their commission (blank until completed). The
// earnings view lists completed referrals with payout status instead of the status column. Nothing else is shown.
export function AffiliateTable({items,earnings,title}){return items.length?<div className="table-wrap" tabIndex={0} role="region" aria-label={title+' table'}><table><caption className="sr-only">{title}</caption><thead><tr><th scope="col">Patient</th><th scope="col">Appointment</th>{!earnings&&<th scope="col">Status</th>}<th scope="col">Your commission</th>{earnings&&<th scope="col">Payout</th>}</tr></thead><tbody>{items.map(b=><tr key={b.id}><td><strong>{b.name}</strong></td><td>{formatDate(b.start)}</td>{!earnings&&<td><span className={'badge '+b.status.toLowerCase()}>{b.status}</span></td>}<td>{completed(b)?money(b.commission):<span className="quiet" aria-label="Not yet completed">—</span>}</td>{earnings&&<td><span className="badge">{b.payout}</span>{b.paidAt&&<small>{formatDate(b.paidAt,{timeStyle:undefined})}</small>}</td>}</tr>)}</tbody></table></div>:<Empty text={earnings?'No completed referrals yet.':undefined}/>;}
