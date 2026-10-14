import { defaultTemplates, doctors, residencyStatuses, documentLinkExpiry } from './config.js';
import { slotTaken, validateSlug, validateGiftCode, validateDoctor, validateDocuments } from './validation.js';
// A demo document record: name, size and type only, marked demo. There is never a file behind it.
const demoDocument = (kind, name, size, mime) => ({ id: crypto.randomUUID(), kind, name, size, mime, uploadedAt: new Date().toISOString(), demo: true });
import { GIFT_CARD_DAYS } from './config.js';
import { issueGiftCard } from './gift.js';
// Each demo optometrist keeps slightly different hours (UTC), so "Choose a doctor" and "Choose a time" visibly
// differ: some times only one of them is free, others both are. A third or later doctor reuses these patterns.
const DEMO_SCHEDULES = [
  { daysOff: [0, 6], hours: [14, 15, 16, 18, 19, 20] }, // Monday to Friday
  { daysOff: [0, 1], hours: [13, 14, 15, 17, 18] }      // Tuesday to Saturday, starting and finishing earlier
];
export function demoSlots(now = new Date()) {
  const slots = [];
  for (let day = 1; day <= 35; day++) {
    const date = new Date(now); date.setUTCDate(date.getUTCDate() + day);
    doctors.forEach((d, i) => {
      const { daysOff, hours } = DEMO_SCHEDULES[i % DEMO_SCHEDULES.length];
      if (daysOff.includes(date.getUTCDay())) return;
      for (const hour of hours) { const start = new Date(date); start.setUTCHours(hour,0,0,0); slots.push({ doctor: d.slug, start: start.toISOString(), duration: 30 }); }
    });
  }
  return slots.sort((a, b) => a.start.localeCompare(b.start) || a.doctor.localeCompare(b.doctor));
}
export function seedDemo() {
  const slots = demoSlots();
  // Sample gift cards for the sample referrals, issued when each sample booking was 'made'.
  const card = (serial, daysAgo) => { const issued = Date.now() - 86400000 * daysAgo; return { serial, issuedAt: new Date(issued).toISOString(), expiresAt: new Date(issued + 86400000 * GIFT_CARD_DAYS).toISOString(), status: 'Issued' }; };
  return {
    affiliates: [{ id: 'demo-alex', name: 'Alex Morgan', slug: 'alex-morgan', email: 'alex@example.com', bio: 'I would love to introduce you to Eyecon’s personal approach to eye care and eyewear.', photo: '/images/affiliate.webp', active: true, commissionRate: 0, commissionNote: 'Commission terms awaiting approval' }],
    bookings: [
      { id:'sample-1',name:'Sample patient 01',email:'sample1@example.com',phone:'+14165550101',doctor:slots[0].doctor,start:slots[0].start,duration:30,service:'eye-exam',source:'Affiliate',affiliateId:'demo-alex',status:'Booked',commission:0,payout:'Pending',firstVisit:true,smsConsent:false,giftCard:card('7K2M9Q',1) },
      { id:'sample-2',name:'Sample patient 02',email:'sample2@example.com',phone:'+14165550102',doctor:doctors[1 % doctors.length].slug,start:new Date(Date.now()-86400000*2).toISOString(),duration:30,service:'styling',source:'Affiliate',affiliateId:'demo-alex',status:'Attended',commission:40,payout:'Pending',firstVisit:false,smsConsent:false,giftCard:card('B4XW8T',9) },
      { id:'sample-3',name:'Sample patient 03',email:'sample3@example.com',phone:'+14165550103',doctor:doctors[0].slug,start:new Date(Date.now()-86400000*8).toISOString(),duration:30,service:'contacts',source:'Direct',affiliateId:null,status:'No-show',commission:0,payout:'Pending',firstVisit:true,smsConsent:false },
      { id:'sample-4',name:'Sample patient 04',email:'sample4@example.com',phone:'+14165550104',doctor:doctors[1 % doctors.length].slug,start:new Date(Date.now()-86400000*10).toISOString(),duration:30,service:'eye-exam',source:'Affiliate',affiliateId:'demo-alex',status:'Attended',commission:30,payout:'Paid',paidAt:new Date().toISOString(),firstVisit:false,smsConsent:false,giftCard:card('R6HD3N',17),residencyStatus:residencyStatuses[0],documents:[demoDocument('government-id','sample-id.pdf',482113,'application/pdf'),demoDocument('diploma','sample-diploma.jpg',1204551,'image/jpeg')] }
    ], templates: defaultTemplates.map(t=>({...t})), slots
  };
}
export function affiliateRows(bookings, id) { return bookings.filter(b=>b.affiliateId===id).map(({id,name,status,start,commission,payout,paidAt})=>({id,name,status,start,commission,payout,paidAt})); }
export function applyDemo(data, action, payload, user) {
  const next = structuredClone(data);
  if (action === 'profile') {
    if (!['affiliate','staff'].includes(user?.role)) throw new Error('Please sign in.');
    const a = next.affiliates.find(a=>a.id === (user.role === 'affiliate' ? user.affiliateId : payload.id));
    if (!a) throw new Error('Affiliate not found.');
    Object.assign(a, { name: payload.name, bio: payload.bio, ...(payload.photo ? { photo:payload.photo } : {}) }); return next;
  }
  if (action === 'booking') { validateDoctor(payload.doctor);const slot=next.slots.find(s=>s.doctor===payload.doctor&&s.start===payload.start);if(!slot||slotTaken(slot,next.bookings)) throw new Error('That time has just been booked. Please choose another.');if(payload.affiliateId&&!next.affiliates.some(a=>a.id===payload.affiliateId&&a.active))throw new Error('This affiliate is inactive.');const giftCard=payload.affiliateId?issueGiftCard(serial=>next.bookings.some(b=>b.giftCard?.serial===serial)):null;next.bookings.unshift({...payload,duration:slot.duration,id:crypto.randomUUID(),status:'Booked',commission:0,payout:'Pending',createdAt:new Date().toISOString(),...(giftCard?{giftCard}:{}),documentsToken:crypto.randomUUID(),documentsExpiresAt:documentLinkExpiry(slot.start)}); return next; }
  // "Complete your file" in the demo: the browser keeps only each file's name, size and type, never its contents.
  if (action === 'documents') {
    const { residencyStatus, files } = validateDocuments(payload);
    const b = next.bookings.find(b => payload.token && b.documentsToken === payload.token);
    if (!b || b.documentsUsedAt || new Date(b.documentsExpiresAt) <= new Date()) throw new Error('This link has expired or has already been used. Please contact the clinic.');
    Object.assign(b, { residencyStatus, documents: files.map(f => demoDocument(f.kind, f.name, f.size, f.type)), documentsUsedAt: new Date().toISOString() });
    return next;
  }
  if (user?.role !== 'staff') throw new Error('Staff access is required.');
  if (action === 'status') { const b=next.bookings.find(b=>b.id===payload.id); if (!b) throw new Error('Booking not found.'); b.status=payload.status; }
  else if (action === 'commission') { const b=next.bookings.find(b=>b.id===payload.id); if (!b || b.payout==='Paid' || b.status!=='Attended' || !b.affiliateId) throw new Error('Only unpaid, attended referrals can receive commission.');if(!Number.isFinite(payload.amount)||payload.amount<0||payload.amount>100000)throw new Error('Invalid commission amount.'); b.commission=payload.amount; }
  else if (action === 'payout') { const chosen=next.bookings.filter(b=>payload.ids.includes(b.id)); if (!chosen.length || chosen.some(b=>!b.affiliateId || b.status!=='Attended' || !(b.commission>0) || b.payout==='Paid')) throw new Error('Select attended referrals with approved unpaid commission.'); chosen.forEach(b=>{b.payout='Paid';b.paidAt=new Date().toISOString();}); }
  else if (action === 'affiliate') { validateSlug(payload.slug);if(next.affiliates.some(a=>a.slug===payload.slug)) throw new Error('That page name already exists.'); const code=validateGiftCode(payload.code);next.affiliates.push({...payload,code,id:crypto.randomUUID(),active:true,photo:payload.photo||'/images/affiliate.webp'}); }
  else if (action === 'toggle-affiliate') { const a=next.affiliates.find(a=>a.id===payload.id); if(a) a.active=!a.active; }
  else if (action === 'template') { next.templates=next.templates.map(t=>t.id===payload.id?{...t,subject:payload.subject,body:payload.body}:t); }
  else if (action === 'slot') { if(!Number.isFinite(new Date(payload.start).getTime())||new Date(payload.start)<=new Date()||![15,30,45,60,90].includes(payload.duration))throw new Error('Choose a future time and valid duration.');validateDoctor(payload.doctor);if(next.slots.some(s=>s.doctor===payload.doctor&&s.start===payload.start)) throw new Error('This optometrist already has this time.');next.slots.push({doctor:payload.doctor,start:payload.start,duration:payload.duration});next.slots.sort((a,b)=>a.start.localeCompare(b.start)||a.doctor.localeCompare(b.doctor)); }
  else throw new Error('Unknown action.');
  return next;
}
