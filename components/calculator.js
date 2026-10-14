'use client';
import { useState } from 'react';
import { Button, Field } from './ui';
import { money } from '@/lib/config';
import { validateCompletion, calculateCommission } from '@/lib/commission';

// The commission calculator for an attended booking. Staff type the amount billed (prefilled from the procedure's
// retail price) and any discount; operation cost and rate are read-only; net and commission update as they type.
// Only gross and discount are sent: the server recalculates everything. A paid booking is shown but locked.
export default function Calculator({booking,affiliate,pricing,busy,onSave}){
  const cost=booking.operationCost??pricing?.operationCost??0,hasAffiliate=!!booking.affiliateId,rate=hasAffiliate?(booking.commissionRate??affiliate?.commissionRate??0):0,locked=booking.payout==='Paid';
  const [gross,setGross]=useState(String(booking.grossAmount??pricing?.retailPrice??0)),[discount,setDiscount]=useState(String(booking.discountAmount??0));
  let calc=null,problem='';try{calc=calculateCommission({...validateCompletion({gross,discount}),operationCost:cost,rate,hasAffiliate});}catch(e){problem=e.message;}
  const id=k=>'calc-'+k+'-'+booking.id;
  return <form className="calculator" onSubmit={e=>{e.preventDefault();if(!problem&&!locked)onSave({id:booking.id,gross,discount});}}>
    <h3>Commission{locked&&<span className="badge">Paid · locked</span>}</h3>
    <div className="calc-grid">
      <Field label="Gross (billed before discount)" id={id('gross')} type="number" inputMode="decimal" min="0" max="1000000" step="0.01" required value={gross} disabled={locked} onChange={e=>setGross(e.target.value)} hint={booking.grossAmount==null&&pricing?'Prefilled from the retail price.':undefined}/>
      <Field label="Discount" id={id('discount')} type="number" inputMode="decimal" min="0" max="1000000" step="0.01" value={discount} disabled={locked} onChange={e=>setDiscount(e.target.value)}/>
      <div className="calc-output"><span>Operation cost</span><output>{money(cost)}</output></div>
      <div className="calc-output"><span>Net</span><output htmlFor={id('gross')+' '+id('discount')}>{calc?money(calc.net):'—'}</output></div>
      <div className="calc-output"><span>Rate</span><output>{hasAffiliate?rate+'%':'No affiliate'}</output></div>
      <div className="calc-output total"><span>Commission</span><output aria-live="polite" htmlFor={id('gross')+' '+id('discount')}>{calc?money(calc.commission):'—'}</output></div>
    </div>
    {problem&&<p className="error-text" role="alert">{problem}</p>}
    {!locked&&<Button disabled={busy||!!problem}>Save</Button>}
  </form>;
}
