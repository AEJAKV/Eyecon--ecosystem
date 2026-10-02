import { defaultTemplates } from './config.js';
import { slotTaken, validateSlug } from './validation.js';
export function demoSlots(now = new Date()) {
  const slots = [];
  for (let day = 1; day <= 35; day++) {
    const date = new Date(now); date.setUTCDate(date.getUTCDate() + day);
    if ([0,6].includes(date.getUTCDay())) continue;
    for (const hour of [14,15,16,18,19,20]) { const start = new Date(date); start.setUTCHours(hour,0,0,0); slots.push({ start: start.toISOString(), duration: 30 }); }
  }
  return slots;
}
export function seedDemo() {
  const slots = demoSlots();
  return {
    affiliates: [{ id: 'demo-alex', name: 'Alex Morgan', slug: 'alex-morgan', email: 'alex@example.com', bio: 'I would love to introduce you to Eyecon’s personal approach to eye care and eyewear.', photo: '/images/affiliate.webp', active: true, commissionRate: 0, commissionNote: 'Commission terms awaiting approval' }],
    bookings: [
      { id:'sample-1',name:'Sample patient 01',email:'sample1@example.com',phone:'+14165550101',start:slots[0].start,duration:30,service:'eye-exam',source:'Affiliate',affiliateId:'demo-alex',status:'Booked',commission:0,payout:'Pending',firstVisit:true,smsConsent:false },
      { id:'sample-2',name:'Sample patient 02',email:'sample2@example.com',phone:'+14165550102',start:new Date(Date.now()-86400000*2).toISOString(),duration:30,service:'styling',source:'Affiliate',affiliateId:'demo-alex',status:'Attended',commission:40,payout:'Pending',firstVisit:false,smsConsent:false },
      { id:'sample-3',name:'Sample patient 03',email:'sample3@example.com',phone:'+14165550103',start:new Date(Date.now()-86400000*8).toISOString(),duration:30,service:'contacts',source:'Direct',affiliateId:null,status:'No-show',commission:0,payout:'Pending',firstVisit:true,smsConsent:false },
      { id:'sample-4',name:'Sample patient 04',email:'sample4@example.com',phone:'+14165550104',start:new Date(Date.now()-86400000*10).toISOString(),duration:30,service:'eye-exam',source:'Affiliate',affiliateId:'demo-alex',status:'Attended',commission:30,payout:'Paid',paidAt:new Date().toISOString(),firstVisit:false,smsConsent:false }
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
  if (action === 'booking') { const slot=next.slots.find(s=>s.start===payload.start);if(!slot||slotTaken(slot,next.bookings)) throw new Error('That time has just been booked. Please choose another.');if(payload.affiliateId&&!next.affiliates.some(a=>a.id===payload.affiliateId&&a.active))throw new Error('This affiliate is inactive.');next.bookings.unshift({...payload,duration:slot.duration,id:crypto.randomUUID(),status:'Booked',commission:0,payout:'Pending',createdAt:new Date().toISOString()}); return next; }
  if (user?.role !== 'staff') throw new Error('Staff access is required.');
  if (action === 'status') { const b=next.bookings.find(b=>b.id===payload.id); if (!b) throw new Error('Booking not found.'); b.status=payload.status; }
  else if (action === 'commission') { const b=next.bookings.find(b=>b.id===payload.id); if (!b || b.payout==='Paid' || b.status!=='Attended' || !b.affiliateId) throw new Error('Only unpaid, attended referrals can receive commission.');if(!Number.isFinite(payload.amount)||payload.amount<0||payload.amount>100000)throw new Error('Invalid commission amount.'); b.commission=payload.amount; }
  else if (action === 'payout') { const chosen=next.bookings.filter(b=>payload.ids.includes(b.id)); if (!chosen.length || chosen.some(b=>!b.affiliateId || b.status!=='Attended' || !(b.commission>0) || b.payout==='Paid')) throw new Error('Select attended referrals with approved unpaid commission.'); chosen.forEach(b=>{b.payout='Paid';b.paidAt=new Date().toISOString();}); }
  else if (action === 'affiliate') { validateSlug(payload.slug);if(next.affiliates.some(a=>a.slug===payload.slug)) throw new Error('That page name already exists.'); next.affiliates.push({...payload,id:crypto.randomUUID(),active:true,photo:payload.photo||'/images/affiliate.webp'}); }
  else if (action === 'toggle-affiliate') { const a=next.affiliates.find(a=>a.id===payload.id); if(a) a.active=!a.active; }
  else if (action === 'template') { next.templates=next.templates.map(t=>t.id===payload.id?{...t,subject:payload.subject,body:payload.body}:t); }
  else if (action === 'slot') { if(!Number.isFinite(new Date(payload.start).getTime())||new Date(payload.start)<=new Date()||![15,30,45,60,90].includes(payload.duration))throw new Error('Choose a future time and valid duration.');if(next.slots.some(s=>s.start===payload.start)) throw new Error('This slot already exists.');next.slots.push(payload);next.slots.sort((a,b)=>a.start.localeCompare(b.start)); }
  else throw new Error('Unknown action.');
  return next;
}
