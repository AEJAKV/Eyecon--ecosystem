'use client';
import { useState } from 'react';
import { Button, Field, Empty } from './ui';
import { DEMO, formatDate } from '@/lib/config';
import { validateTeamMember } from '@/lib/front-desk';

// Staff admin > Team: invite front desk members and turn their access off or on. The front desk signs in to /desk and
// sees Bookings, Gift cards and Leads only, with no commissions, payouts, pricing or procedure amounts.
export default function TeamAdmin({ team, busy, run, action }) {
  const [problem, setProblem] = useState('');
  async function invite(e) {
    e.preventDefault(); setProblem('');
    const form = e.currentTarget, f = new FormData(form);
    let member;
    try { member = validateTeamMember({ name: f.get('name'), email: f.get('email') }); } catch (err) { setProblem(err.message); return; }
    const result = await run(() => action('team-invite', member), DEMO ? member.name + ' added. In the demo no email is sent.' : 'Invitation sent to ' + member.email + '. They set a password from the email, then sign in to the front desk.');
    if (result !== false) form.reset();
  }
  return <>
    <p className="muted">The front desk sees Bookings, Gift cards and Leads, including patient contact details, insurance and documents. They never see commissions, payouts, pricing or amounts billed.</p>
    <form className="panel stack narrow-panel" onSubmit={invite} noValidate>
      <h2>Invite a front desk member</h2>
      <div className="form-grid">
        <Field label="Full name" id="team-name" name="name" required maxLength={120} />
        <Field label="Email address" id="team-email" name="email" type="email" required maxLength={254} />
      </div>
      {problem && <p className="error-text" role="alert">{problem}</p>}
      <Button disabled={busy}>Send invitation</Button>
    </form>
    {team.length ? <div className="table-wrap" tabIndex={0} role="region" aria-label="Front desk team table"><table>
      <caption className="sr-only">Front desk team</caption>
      <thead><tr><th scope="col">Name</th><th scope="col">Added</th><th scope="col">Access</th><th scope="col">Actions</th></tr></thead>
      <tbody>{team.map(t => <tr key={t.id}>
        <td><strong>{t.name || 'Name not recorded'}</strong><small>{t.email}</small></td>
        <td>{t.createdAt ? formatDate(t.createdAt, { timeStyle: undefined }) : '—'}</td>
        <td><span className={'badge ' + (t.active ? 'attended' : 'no-show')}>{t.active ? 'Active' : 'Inactive'}</span></td>
        <td><button className="text-link" disabled={busy} onClick={() => run(() => action('team-toggle', { id: t.id }), t.active ? (t.name || t.email) + ' can no longer sign in to the front desk.' : (t.name || t.email) + ' can sign in to the front desk again.')}>{t.active ? 'Deactivate' : 'Activate'}<span className="sr-only"> {t.name || t.email}</span></button></td>
      </tr>)}</tbody>
    </table></div> : <Empty text="No front desk members yet. Invite one above." />}
  </>;
}
