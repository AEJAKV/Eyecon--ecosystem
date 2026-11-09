import { defaultTemplates, doctors, placeholderDoctors, residencyStatuses, documentLinkExpiry, services, clinic, findDoctor } from './config.js';
import { planSlots, mergeGeneratedSlots, validateDoctorProfile, validateWeeklyHours, validateTimeOff, validateExtraHours, isVisible, offersService, inTimeOff, removalPlan, removalRefusal } from './schedule.js';
import { validateCompletion, validatePricing, calculateCommission } from './commission.js';
import { slotTaken, validateSlug, validateGiftCode, validateDoctor, validateDocuments, validateClaim } from './validation.js';
// A demo document record: name, size and type only, marked demo. There is never a file behind it.
const demoDocument = (kind, name, size, mime) => ({ id: crypto.randomUUID(), kind, name, size, mime, uploadedAt: new Date().toISOString(), demo: true });
import { GIFT_CARD_DAYS } from './config.js';
import { issueGiftCard, releaseGiftCard, checkGiftClaim, bookingReference, parseGiftNumber, giftNumber, giftScanView, checkRedeem, giftPublicStatus } from './gift.js';
import { validateLookup, lookupView, needsDocumentsLink, LOOKUP_NOT_FOUND } from './lookup.js';
import { fileComplete } from './validation.js';
import { restrictAffiliateRow } from './affiliate.js';
import { isClinic, canAct, FRONT_DESK_ROLE, validateTeamMember } from './front-desk.js';
import { newBookingIds, newClaimIds } from './seen.js';
import { validateDraft, demoKeyOk, newDraft, blogStep, canEditPost, canSeePost, canDeletePost, canWriteBlog, isReviewer, slugify, validateComment, publicPost, COMMENTS_PER_HOUR } from './blog.js';
// Sample weekly hours in clinic time, so "Choose a doctor" and "Choose a time" visibly differ: some times only one
// optometrist is free, others both are. A third or later doctor reuses these patterns. Staff can change them in
// Staff admin > Doctors, exactly as in live mode.
const DEMO_HOURS = [
  [[1,'09:00','12:00'],[1,'13:00','17:00'],[2,'09:00','12:00'],[2,'13:00','17:00'],[3,'09:00','12:00'],[3,'13:00','17:00'],[4,'09:00','12:00'],[4,'13:00','17:00'],[5,'09:00','12:00'],[5,'13:00','17:00']], // Monday to Friday, lunch 12–1
  [[2,'08:00','11:30'],[2,'12:30','16:00'],[3,'08:00','11:30'],[3,'12:30','16:00'],[4,'08:00','11:30'],[4,'12:30','16:00'],[5,'08:00','11:30'],[5,'12:30','16:00'],[6,'10:00','15:00']] // Tuesday to Saturday, earlier
];
export function demoWeeklyHours(list = placeholderDoctors) {
  let id = 0;
  return list.flatMap((d, i) => DEMO_HOURS[i % DEMO_HOURS.length].map(([weekday, start, end]) => ({ id: ++id, doctor: d.slug, weekday, start, end })));
}
const scheduleOf = data => ({ doctors: data.doctors || placeholderDoctors, weeklyHours: data.weeklyHours || [], extraHours: data.extraHours || [], timeOff: data.timeOff || [], timeZone: clinic.timezone });
export function demoSlots(now = new Date()) {
  return planSlots({ doctors: placeholderDoctors, weeklyHours: demoWeeklyHours(), timeZone: clinic.timezone, now });
}
// After any schedule change: regenerate that optometrist's slots (or everyone's), keeping booked and hand-added ones.
function regenerate(next, doctor = null) { next.slots = mergeGeneratedSlots(next.slots, planSlots(scheduleOf(next)), next.bookings, { doctor }); }
const nextId = list => (list || []).reduce((m, x) => Math.max(m, Number(x.id) || 0), 0) + 1;
export function seedDemo() {
  const slots = demoSlots();
  const demoDoctors = placeholderDoctors.map(d => ({ ...d }));
  // Sample gift cards for the sample referrals, issued when each sample booking was 'made'.
  const card = (serial, daysAgo) => { const issued = Date.now() - 86400000 * daysAgo; return { serial, issuedAt: new Date(issued).toISOString(), expiresAt: new Date(issued + 86400000 * GIFT_CARD_DAYS).toISOString(), status: 'Issued' }; };
  return {
    giftCards: [], // cards released to visitors who opened an affiliate link (see demoReleaseGift)
    giftClaims: [], // cards claimed without booking ("Already have a prescription", see the 'claim' action)
    affiliates: [{ id: 'demo-alex', name: 'Alex Morgan', slug: 'alex-morgan', email: 'alex@example.com', bio: 'I would love to introduce you to Eyecon’s personal approach to eye care and eyewear.', photo: '/images/affiliate.webp', active: true, commissionRate: 10, commissionNote: '[Written commission terms]' }],
    bookings: [
      { id:'sample-1',reference:'7K2M9QXB',name:'Sample patient 01',email:'sample1@example.com',phone:'+14165550101',doctor:slots[0].doctor,start:slots[0].start,duration:30,service:'eye-exam',source:'Affiliate',affiliateId:'demo-alex',status:'Booked',commission:0,payout:'Pending',firstVisit:true,smsConsent:false,giftCard:card('7K2M9Q',1) },
      { id:'sample-2',reference:'B4XW8TRA',name:'Sample patient 02',email:'sample2@example.com',phone:'+14165550102',doctor:doctors[1 % doctors.length].slug,start:new Date(Date.now()-86400000*2).toISOString(),duration:30,service:'styling',source:'Affiliate',affiliateId:'demo-alex',status:'Attended',grossAmount:600,discountAmount:0,operationCost:200,netAmount:400,commissionRate:10,commission:40,payout:'Pending',firstVisit:false,smsConsent:false,giftCard:card('B4XW8T',9) },
      { id:'sample-3',reference:'H3CZ6PLE',name:'Sample patient 03',email:'sample3@example.com',phone:'+14165550103',doctor:doctors[0].slug,start:new Date(Date.now()-86400000*8).toISOString(),duration:30,service:'contacts',source:'Direct',affiliateId:null,status:'No-show',commission:0,payout:'Pending',firstVisit:true,smsConsent:false },
      { id:'sample-4',reference:'R6HD3NVU',name:'Sample patient 04',email:'sample4@example.com',phone:'+14165550104',doctor:doctors[1 % doctors.length].slug,start:new Date(Date.now()-86400000*10).toISOString(),duration:30,service:'eye-exam',source:'Affiliate',affiliateId:'demo-alex',status:'Attended',grossAmount:500,discountAmount:50,operationCost:150,netAmount:300,commissionRate:10,commission:30,payout:'Paid',paidAt:new Date().toISOString(),firstVisit:false,smsConsent:false,giftCard:card('R6HD3N',17),residencyStatus:residencyStatuses[0],documents:[demoDocument('government-id','sample-id.pdf',482113,'application/pdf'),demoDocument('diploma','sample-diploma.jpg',1204551,'image/jpeg')] }
    ], templates: defaultTemplates.map(t=>({...t})), slots,
    // Procedure prices start at 0, as in the live database, until staff fill in Pricing.
    procedureCosts: services.map(s => ({ service: s.id, retailPrice: 0, operationCost: 0 })),
    // Optometrists and their schedules (Staff admin > Doctors), as in migration 010.
    doctors: demoDoctors, weeklyHours: demoWeeklyHours(demoDoctors), timeOff: [], extraHours: [],
    // Front desk members (Staff admin > Team), as in migration 015. The demo front desk signs in as this one.
    team: [{ id: 'demo-desk', name: '[Front desk team member]', email: 'frontdesk@example.com', active: true, createdAt: new Date().toISOString() }],
    // The blog (migration 016): a published sample post by the demo affiliate, one waiting for review from the front
    // desk, and a reader's comment waiting for approval. Every word is a [bracketed placeholder].
    ...seedBlog()
  };
}
// /my-booking in the demo: the same checks and the same limited view as the live lookup, on this browser's data.
export function demoLookup(data, input) {
  const { reference, email } = validateLookup(input);
  const b = data.bookings.find(b => b.reference === reference && b.email === email);
  if (!b) throw new Error(LOOKUP_NOT_FOUND);
  const a = data.affiliates.find(a => a.id === b.affiliateId);
  const view = lookupView(b, { affiliate: a ? { name: a.name, code: a.code } : null, fileComplete: fileComplete(b) });
  const linkOpen = b.documentsToken && !b.documentsUsedAt && new Date(b.documentsExpiresAt) > new Date();
  return needsDocumentsLink(view) && linkOpen ? { ...view, documentsToken: b.documentsToken } : view;
}
// The affiliate's restricted view of their referrals: see lib/affiliate.js for the allowed fields.
export function affiliateRows(bookings, id) { return bookings.filter(b=>b.affiliateId===id).map(restrictAffiliateRow); }
// The demo's release of a gift card when a visitor opens an affiliate's link: the same card the live API returns
// ({ serial, releasedAt, expiresAt, token }), recorded in the demo data so a booking can claim it. The demo keeps the
// token itself, where the live site keeps only its hash.
// The demo's public card status: the same as /api/gift/status (giftStatus in lib/server.js).
export function demoGiftStatus(data, number, now = new Date()) {
  const serial = parseGiftNumber(number);
  if (!serial) return null;
  const affiliate = id => { const a = data.affiliates.find(a => a.id === id); return a ? { name: a.name, code: a.code || null } : null; };
  const b = data.bookings.find(b => b.giftCard?.serial === serial);
  if (b) return giftPublicStatus(number, { ...b.giftCard, affiliate: affiliate(b.affiliateId) }, now);
  const c = (data.giftClaims || []).find(c => c.serial === serial);
  return c ? giftPublicStatus(number, { ...c, affiliate: affiliate(c.affiliateId) }, now) : null;
}
// The demo's staff scan of a gift card: the same rules and fields as /api/gift/scan (scanGiftCard in lib/server.js).
export function demoScanGift(data, number, user, now = new Date()) {
  if (!isClinic(user)) throw new Error('Staff access is required.');
  const serial = parseGiftNumber(number);
  if (!serial) throw new Error('That is not an Eyecon gift card number.');
  const code = id => { const a = data.affiliates.find(a => a.id === id); return a ? { name: a.name, code: a.code || null } : null; };
  const b = data.bookings.find(b => b.giftCard?.serial === serial);
  if (b) return giftScanView({ kind: 'booking', number: giftNumber(code(b.affiliateId), serial), status: b.giftCard.status, issuedAt: b.giftCard.issuedAt, expiresAt: b.giftCard.expiresAt, redeemedAt: b.giftCard.redeemedAt, name: b.name, email: b.email, booking: b }, now);
  const c = (data.giftClaims || []).find(c => c.serial === serial);
  if (c) return giftScanView({ kind: 'prescription', number: giftNumber(code(c.affiliateId), serial), status: c.status, issuedAt: c.issuedAt, expiresAt: c.expiresAt, redeemedAt: c.redeemedAt, name: c.name, email: c.email }, now);
  throw new Error('No gift card has this number. Check it and try again.');
}
export function demoReleaseGift(data, slug, now = new Date()) {
  const a = data.affiliates.find(a => a.slug === slug && a.active);
  if (!a) throw new Error('This referral page is unavailable.');
  const next = structuredClone(data); next.giftCards ||= [];
  const card = releaseGiftCard(serial => next.giftCards.some(c => c.serial === serial) || next.bookings.some(b => b.giftCard?.serial === serial), now);
  const token = crypto.randomUUID() + crypto.randomUUID();
  next.giftCards.push({ id: crypto.randomUUID(), affiliateId: a.id, serial: card.serial, releasedAt: card.releasedAt, expiresAt: card.expiresAt, status: 'Released', bookingId: null, token });
  return { data: next, card: { serial: card.serial, releasedAt: card.releasedAt, expiresAt: card.expiresAt, token } };
}
// New-booking ids for a demo user (lib/seen.js decides). Sample bookings have no createdAt, so only bookings made in
// the demo are flagged; an affiliate only ever sees their own referrals.
const SEEN_EPOCH = '1970-01-01T00:00:00.000Z';
const seenKey = user => user.role === 'affiliate' ? 'affiliate:' + user.affiliateId : user.role;
export function demoNewIds(data, user) {
  if (!user || !data?.bookings) return [];
  const own = data.seen?.[seenKey(user)] || { at: SEEN_EPOCH, viewed: [] };
  return newBookingIds(user.role === 'affiliate' ? data.bookings.filter(b => b.affiliateId === user.affiliateId) : data.bookings, own.at, own.viewed);
}
export function demoNewClaimIds(data, user) {
  if (!isClinic(user) || !data?.giftClaims) return [];
  return newClaimIds(data.giftClaims, data.seen?.[seenKey(user)]?.giftsAt || SEEN_EPOCH);
}
export function applyDemo(data, action, payload, user) {
  if (action.startsWith('blog-')) return applyDemoBlog(data, action, payload, user);
  const next = structuredClone(data);
  // The gold dot: "Mark all seen" or one booking opened, kept per demo user like the live per-user state.
  if (action === 'seen-gifts') { if (!isClinic(user)) throw new Error('Staff access is required.'); next.seen ||= {}; const key = seenKey(user); next.seen[key] = { at: SEEN_EPOCH, viewed: [], ...next.seen[key], giftsAt: new Date().toISOString() }; return next; }
  if (action === 'seen') { if (!user) throw new Error('Please sign in.'); next.seen ||= {}; const key = seenKey(user), own = next.seen[key] || { at: SEEN_EPOCH, viewed: [] }; next.seen[key] = payload?.id && user.role !== 'affiliate' ? { ...own, viewed: [...own.viewed, payload.id] } : { ...own, at: new Date().toISOString(), viewed: [] }; return next; }
  if (action === 'profile') {
    if (!['affiliate','staff'].includes(user?.role)) throw new Error('Please sign in.');
    const a = next.affiliates.find(a=>a.id === (user.role === 'affiliate' ? user.affiliateId : payload.id));
    if (!a) throw new Error('Affiliate not found.');
    Object.assign(a, { name: payload.name, bio: payload.bio, ...(payload.photo ? { photo:payload.photo } : {}) }); return next;
  }
  if (action === 'booking') { validateDoctor(payload.doctor);const doc=findDoctor(payload.doctor);if(!isClinic(user)&&(!isVisible(doc)||!offersService(doc,payload.service)))throw new Error('Please choose another optometrist or time.');const slot=next.slots.find(s=>s.doctor===payload.doctor&&s.start===payload.start);if(!slot||slotTaken(slot,next.bookings)||inTimeOff(slot,next.timeOff)) throw new Error('That time has just been booked. Please choose another.');if(payload.affiliateId&&!next.affiliates.some(a=>a.id===payload.affiliateId&&a.active))throw new Error('This affiliate is inactive.');const {giftToken,...fields}=payload,id=crypto.randomUUID();let giftCard=null;if(payload.affiliateId){if(giftToken){next.giftCards||=[];const held=next.giftCards.find(c=>c.token===giftToken);if(checkGiftClaim(held&&{affiliateId:held.affiliateId,expiresAt:held.expiresAt,status:held.status,bookingId:held.bookingId},payload.affiliateId).ok){giftCard={serial:held.serial,issuedAt:held.releasedAt,expiresAt:held.expiresAt,status:'Claimed'};held.status='Claimed';held.bookingId=id;}}else giftCard=issueGiftCard(serial=>next.bookings.some(b=>b.giftCard?.serial===serial)||(next.giftCards||[]).some(c=>c.serial===serial));}next.bookings.unshift({...fields,duration:slot.duration,id,reference:bookingReference(ref=>next.bookings.some(b=>b.reference===ref)),status:'Booked',commission:0,payout:'Pending',createdAt:new Date().toISOString(),...(giftCard?{giftCard}:{}),documentsToken:crypto.randomUUID(),documentsExpiresAt:documentLinkExpiry(slot.start)}); return next; }
  // "Complete your file" in the demo: the browser keeps only each file's name, size and type, never its contents.
  if (action === 'documents') {
    const { residencyStatus, files } = validateDocuments(payload);
    const b = next.bookings.find(b => payload.token && b.documentsToken === payload.token);
    if (!b || b.documentsUsedAt || new Date(b.documentsExpiresAt) <= new Date()) throw new Error('This link has expired or has already been used. Please contact the clinic.');
    Object.assign(b, { residencyStatus, documents: files.map(f => demoDocument(f.kind, f.name, f.size, f.type)), documentsUsedAt: new Date().toISOString() });
    return next;
  }
  // "Already have a prescription": the same rules as claim_prescription_gift (migration 012). The demo keeps only
  // whether a health card or policy number was given, never the numbers.
  if (action === 'claim') {
    const c = validateClaim(payload);
    if (!next.affiliates.some(a => a.id === c.affiliateId && a.active)) throw new Error('This referral is no longer available.');
    next.giftClaims ||= [];
    if (next.giftClaims.some(g => g.affiliateId === c.affiliateId && g.email === c.email)) throw new Error('A gift card has already been sent to this email address. Please check your inbox, or contact the clinic.');
    const card = issueGiftCard(serial => next.bookings.some(b => b.giftCard?.serial === serial) || (next.giftCards || []).some(g => g.serial === serial) || next.giftClaims.some(g => g.serial === serial));
    next.giftClaims.unshift({ id: crypto.randomUUID(), affiliateId: c.affiliateId, serial: card.serial, name: c.name, email: c.email, healthCardGiven: !!c.healthCard, insurance: c.insurance || null, policyGiven: !!c.policy, issuedAt: card.issuedAt, expiresAt: card.expiresAt, status: 'Issued' });
    return next;
  }
  // Staff admin may do everything below; the front desk only FRONT_DESK_ACTIONS (lib/front-desk.js), as in live mode.
  if (!isClinic(user) || !canAct(user.role, action)) throw new Error('Staff access is required.');
  if (user.role === FRONT_DESK_ROLE && (next.team || []).find(t => t.id === user.teamId)?.active === false) throw new Error('This front desk account is inactive.');
  // Mark a gift card redeemed, or undo it (payload.redeemed false): the same rules as setGiftRedeemed in lib/server.js.
  if (action === 'gift-redeem') {
    const serial = parseGiftNumber(payload.number), redeem = payload.redeemed !== false;
    if (!serial) throw new Error('That is not an Eyecon gift card number.');
    const b = next.bookings.find(b => b.giftCard?.serial === serial), c = !b && (next.giftClaims || []).find(c => c.serial === serial);
    const card = b ? b.giftCard : c;
    const decision = checkRedeem(card && { status: card.status, expiresAt: card.expiresAt }, redeem);
    if (!decision.ok) throw new Error(decision.message);
    const back = b ? ((next.giftCards || []).some(g => g.bookingId === b.id) ? 'Claimed' : 'Issued') : 'Issued';
    Object.assign(card, redeem ? { status: 'Redeemed', redeemedAt: new Date().toISOString() } : { status: back, redeemedAt: null });
    return next;
  }
  if (action === 'status') { const b=next.bookings.find(b=>b.id===payload.id); if (!b) throw new Error('Booking not found.'); b.status=payload.status; }
  // Complete an appointment with the amount billed and any discount: the same calculation as complete_appointment in
  // migration 007. The operation cost and rate are snapshots, kept from the first completion.
  else if (action === 'complete') {
    const b=next.bookings.find(b=>b.id===payload.id); if (!b) throw new Error('Booking not found.');
    if (b.payout==='Paid') throw new Error('This referral has been paid, so its commission is locked.');
    const { gross, discount } = validateCompletion(payload);
    const affiliate = next.affiliates.find(a=>a.id===b.affiliateId);
    const operationCost = b.operationCost ?? next.procedureCosts?.find(p=>p.service===b.service)?.operationCost ?? 0;
    const rate = b.affiliateId ? (b.commissionRate ?? affiliate?.commissionRate ?? 0) : null;
    const c = calculateCommission({ gross, discount, operationCost, rate: rate || 0, hasAffiliate: !!b.affiliateId });
    Object.assign(b, { status:'Attended', grossAmount:c.gross, discountAmount:c.discount, operationCost:c.operationCost, netAmount:c.net, commissionRate:b.affiliateId?c.rate:null, commission:c.commission });
  }
  else if (action === 'pricing') { if(!services.some(s=>s.id===payload.service)) throw new Error('Unknown procedure.'); const { retailPrice, operationCost } = validatePricing(payload); next.procedureCosts=services.map(s=>{const p=next.procedureCosts?.find(p=>p.service===s.id)||{service:s.id,retailPrice:0,operationCost:0};return s.id===payload.service?{...p,retailPrice,operationCost,updatedAt:new Date().toISOString()}:p;}); }
  else if (action === 'payout') { const chosen=next.bookings.filter(b=>payload.ids.includes(b.id)); if (!chosen.length || chosen.some(b=>!b.affiliateId || b.status!=='Attended' || !(b.commission>0) || b.payout==='Paid')) throw new Error('Select attended referrals with approved unpaid commission.'); chosen.forEach(b=>{b.payout='Paid';b.paidAt=new Date().toISOString();}); }
  else if (action === 'affiliate') { validateSlug(payload.slug);if(next.affiliates.some(a=>a.slug===payload.slug)) throw new Error('That page name already exists.'); const code=validateGiftCode(payload.code);next.affiliates.push({...payload,code,id:crypto.randomUUID(),active:true,photo:payload.photo||'/images/placeholder-person.svg'}); }
  // Staff admin > Team: the same rules as inviteTeamMember and setTeamActive in lib/server.js. No email is sent.
  else if (action === 'team-invite') { const m = validateTeamMember(payload); next.team ||= []; if (next.team.some(t => t.email === m.email)) throw new Error('This email already has an account. Use a different email, or ask the clinic’s developer to review the account.'); next.team.push({ id: crypto.randomUUID(), ...m, active: true, createdAt: new Date().toISOString() }); }
  else if (action === 'team-toggle') { const t = (next.team || []).find(t => t.id === payload.id); if (!t) throw new Error('Team member not found.'); t.active = !t.active; }
  else if (action === 'toggle-affiliate') { const a=next.affiliates.find(a=>a.id===payload.id); if(a) a.active=!a.active; }
  else if (action === 'template') { next.templates=next.templates.map(t=>t.id===payload.id?{...t,subject:payload.subject,body:payload.body}:t); }
  else if (action === 'slot') { if(!Number.isFinite(new Date(payload.start).getTime())||new Date(payload.start)<=new Date()||![15,30,45,60,90].includes(payload.duration))throw new Error('Choose a future time and valid duration.');validateDoctor(payload.doctor);if(next.slots.some(s=>s.doctor===payload.doctor&&s.start===payload.start)) throw new Error('This optometrist already has this time.');next.slots.push({doctor:payload.doctor,start:payload.start,duration:payload.duration});next.slots.sort((a,b)=>a.start.localeCompare(b.start)||a.doctor.localeCompare(b.doctor)); }
  // Optometrists and schedules: the same rules as /api/doctors. Nothing is ever deleted; hidden optometrists keep
  // their name on past bookings. Every schedule change regenerates that optometrist's times straight away.
  else if (action === 'doctor') {
    const d = validateDoctorProfile(payload);
    next.doctors ||= placeholderDoctors.map(x => ({ ...x }));
    if (payload.isNew) {
      if (next.doctors.some(x => x.slug === d.slug)) throw new Error('An optometrist with this page name already exists.');
      next.doctors.push({ ...d, photo: payload.photo || '/images/placeholder-person.svg', alt: d.alt || '', order: Math.max(0, ...next.doctors.map(x => x.order || 0)) + 1 });
    } else {
      const x = next.doctors.find(x => x.slug === d.slug); if (!x) throw new Error('Optometrist not found.');
      Object.assign(x, d, payload.photo ? { photo: payload.photo, alt: '' } : {});
      regenerate(next, d.slug);
    }
  }
  else if (action === 'doctor-remove') {
    const d = next.doctors.find(x => x.slug === payload.slug && !x.removed); if (!d) throw new Error('Optometrist not found.');
    const plan = removalPlan(d.slug, next.bookings);
    if (plan.mode === 'refuse') throw new Error(removalRefusal(`${d.title} ${d.first} ${d.last}`, plan.upcoming));
    next.weeklyHours = (next.weeklyHours || []).filter(h => h.doctor !== d.slug); next.extraHours = (next.extraHours || []).filter(h => h.doctor !== d.slug);
    if (plan.mode === 'delete') { next.doctors = next.doctors.filter(x => x.slug !== d.slug); next.slots = next.slots.filter(s => s.doctor !== d.slug); next.timeOff = (next.timeOff || []).filter(t => t.doctor !== d.slug); }
    else { Object.assign(d, { visible: false, removed: true }); regenerate(next, d.slug); }
  }
  else if (action === 'doctor-order') { const order = payload.slugs || []; next.doctors.forEach(d => { const i = order.indexOf(d.slug); if (i > -1) d.order = i + 1; }); }
  else if (action === 'doctor-hours') {
    const d = next.doctors.find(x => x.slug === payload.doctor); if (!d) throw new Error('Optometrist not found.');
    const minutes = Number(payload.slotMinutes); if (![15,30,45,60,90].includes(minutes)) throw new Error('Choose an appointment length of 15, 30, 45, 60 or 90 minutes.');
    const hours = validateWeeklyHours(payload.hours); d.slotMinutes = minutes;
    let id = nextId(next.weeklyHours);
    next.weeklyHours = [...(next.weeklyHours || []).filter(h => h.doctor !== d.slug), ...hours.map(h => ({ ...h, id: id++, doctor: d.slug }))];
    regenerate(next, d.slug);
  }
  else if (action === 'time-off-add') {
    if (!next.doctors.some(x => x.slug === payload.doctor)) throw new Error('Optometrist not found.');
    const off = validateTimeOff(payload, clinic.timezone);
    next.timeOff = [...(next.timeOff || []), { id: nextId(next.timeOff), doctor: payload.doctor, ...off }].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    regenerate(next, payload.doctor);
  }
  else if (action === 'time-off-remove') { const t = (next.timeOff || []).find(t => t.id === payload.id); if (!t) throw new Error('Time off not found.'); next.timeOff = next.timeOff.filter(x => x !== t); regenerate(next, t.doctor); }
  else if (action === 'extra-add') {
    if (!next.doctors.some(x => x.slug === payload.doctor)) throw new Error('Optometrist not found.');
    const x = validateExtraHours(payload);
    next.extraHours = [...(next.extraHours || []), { id: nextId(next.extraHours), doctor: payload.doctor, ...x }].sort((a, b) => a.day.localeCompare(b.day) || a.start.localeCompare(b.start));
    regenerate(next, payload.doctor);
  }
  else if (action === 'extra-remove') { const x = (next.extraHours || []).find(x => x.id === payload.id); if (!x) throw new Error('Extra hours not found.'); next.extraHours = next.extraHours.filter(y => y !== x); regenerate(next, x.doctor); }
  else throw new Error('Unknown action.');
  return next;
}

// ---------- The blog in the demo ----------
// The same rules as the live blog (lib/blog.js and lib/blog-server.js), on this browser's data. Pictures are kept in
// the browser as data URLs, so a demo post can show them without any storage.
const sampleRuns = t => [{ t }];
function samplePost({ id, slug, authorId, authorRole, authorName, authorAffiliate = null, status, title, category, cover, daysAgo }) {
  const draft = {
    title, excerpt: '[One or two sentences that introduce the post]', category, tags: ['sample'], cover: { key: cover, alt: '[Picture description]' },
    blocks: [
      { id: 'sp' + id + 'a', type: 'paragraph', text: [{ t: '[Opening paragraph: what the reader will learn. ' }, { t: '[Bold words]', b: true }, { t: ' and a ' }, { t: '[link to booking]', href: '/booking' }, { t: '.]' }] },
      { id: 'sp' + id + 'b', type: 'heading', level: 2, text: '[Section heading]' },
      { id: 'sp' + id + 'c', type: 'paragraph', text: sampleRuns('[Section text.]') },
      { id: 'sp' + id + 'd', type: 'list', ordered: false, items: [sampleRuns('[First point]'), sampleRuns('[Second point]'), sampleRuns('[Third point]')] },
      { id: 'sp' + id + 'e', type: 'quote', text: sampleRuns('[A short quote from the optometrist]'), cite: '[Name], OD' },
      { id: 'sp' + id + 'f', type: 'button', label: 'Book an eye exam' }
    ], schedule: 'asap', publishAt: null, comments: true
  };
  const at = new Date(Date.now() - 86400000 * daysAgo).toISOString(), live = status === 'approved';
  return { id, slug: live ? slug : null, authorId, authorRole, authorName, authorAffiliate, status, draft, published: live ? draft : null, publishedAt: live ? at : null, reviewNote: '', submittedAt: at, reviewedAt: live ? at : null, createdAt: at, updatedAt: at };
}
export function seedBlog() {
  return {
    blogPosts: [
      samplePost({ id: 'demo-post-2', authorId: 'desk:demo-desk', authorRole: 'front-desk', authorName: '[Front desk team member]', status: 'review', title: '[Second sample post title]', category: 'Clinic news', cover: '/images/hero-desktop.webp', daysAgo: 1 }),
      samplePost({ id: 'demo-post-1', slug: 'sample-post', authorId: 'affiliate:demo-alex', authorRole: 'affiliate', authorName: 'Alex Morgan', authorAffiliate: 'demo-alex', status: 'approved', title: '[Sample post title]', category: 'Eye health', cover: '/images/hero.webp', daysAgo: 3 })
    ],
    blogComments: [{ id: 'demo-comment-1', postId: 'demo-post-1', name: 'Sample reader', body: '[Sample comment waiting for approval]', status: 'pending', createdAt: new Date(Date.now() - 3600000).toISOString() }]
  };
}
// The demo's signed-in person as the blog sees them: an id for authorship and the full name kept on their posts.
export function demoBlogUser(data, user) {
  if (!canWriteBlog(user)) return null;
  if (user.role === 'affiliate') return { ...user, id: 'affiliate:' + user.affiliateId, name: data.affiliates.find(a => a.id === user.affiliateId)?.name || '' };
  if (user.role === FRONT_DESK_ROLE) { const id = user.teamId || 'demo-desk'; return { ...user, id: 'desk:' + id, name: (data.team || []).find(t => t.id === id)?.name || '' }; }
  return { ...user, id: 'demo-staff', name: '' };
}
// Published posts as readers see them (the demo /blog pages).
export function demoPublicPosts(data, now = new Date()) {
  const slugOf = id => data.affiliates.find(a => a.id === id && a.active)?.slug || null;
  return (data.blogPosts || []).map(p => publicPost(p, { imageUrl: k => k, affiliateSlug: slugOf(p.authorAffiliate), now })).filter(Boolean);
}
export function demoApprovedComments(data, slug) {
  const post = (data.blogPosts || []).find(p => p.slug === slug);
  return post ? (data.blogComments || []).filter(c => c.postId === post.id && c.status === 'approved').map(({ id, name, body, createdAt }) => ({ id, name, body, createdAt })) : [];
}
function applyDemoBlog(data, action, payload = {}, user, now = new Date()) {
  const next = structuredClone(data);
  next.blogPosts ||= []; next.blogComments ||= [];
  // A reader's comment (no sign-in): only on a live post that allows comments, and only a few an hour.
  if (action === 'blog-comment') {
    const c = validateComment(payload);
    const post = next.blogPosts.find(p => p.slug === payload.slug && p.published && new Date(p.publishedAt) <= now);
    if (!post || post.published.comments === false) throw new Error('Comments are closed on this post.');
    if (next.blogComments.filter(x => x.demo && now - new Date(x.createdAt) < 3600000).length >= COMMENTS_PER_HOUR) throw new Error('Too many comments. Please try again later.');
    next.blogComments.unshift({ id: crypto.randomUUID(), postId: post.id, ...c, status: 'pending', createdAt: now.toISOString(), demo: true });
    return next;
  }
  const me = demoBlogUser(data, user);
  if (!me) throw new Error('Please sign in.');
  const find = id => { const p = next.blogPosts.find(p => p.id === id); if (!p || !canSeePost(p, me)) throw new Error('Post not found.'); return p; };
  if (action === 'blog-create') {
    const post = { id: crypto.randomUUID(), slug: null, authorId: me.id, authorRole: me.role, authorName: me.name, authorAffiliate: me.role === 'affiliate' ? me.affiliateId : null, status: 'draft', draft: newDraft(), published: null, publishedAt: null, reviewNote: '', submittedAt: null, reviewedAt: null, createdAt: now.toISOString(), updatedAt: now.toISOString() };
    next.blogPosts.unshift(post); return next;
  }
  if (action === 'blog-save') {
    const post = find(payload.id);
    if (!canEditPost(post, me)) throw new Error('This post can’t be edited right now.');
    Object.assign(post, { draft: validateDraft(payload.draft, { keyOk: demoKeyOk }), updatedAt: now.toISOString() });
    return next;
  }
  if (action === 'blog-step') {
    const post = find(payload.id), patch = blogStep(post, payload.step, me, { note: payload.note, confirm: payload.confirm, now });
    if (patch.status === 'approved' && !post.slug) { const taken = new Set(next.blogPosts.map(p => p.slug).filter(Boolean)); post.slug = demoSlug(post.draft.title, taken); }
    Object.assign(post, patch, { updatedAt: now.toISOString() });
    return next;
  }
  if (action === 'blog-delete') {
    const post = find(payload.id);
    if (!canDeletePost(post, me)) throw new Error('Only a post that was never published can be deleted.');
    next.blogPosts = next.blogPosts.filter(p => p !== post); next.blogComments = next.blogComments.filter(c => c.postId !== post.id);
    return next;
  }
  if (action === 'blog-comment-approve' || action === 'blog-comment-delete') {
    if (!isReviewer(me)) throw new Error('Only staff admin can moderate comments.');
    const c = next.blogComments.find(c => c.id === payload.id); if (!c) throw new Error('Comment not found.');
    if (action === 'blog-comment-approve') Object.assign(c, { status: 'approved', reviewedAt: now.toISOString() });
    else next.blogComments = next.blogComments.filter(x => x !== c);
    return next;
  }
  throw new Error('Unknown action.');
}
// The first free page name, as uniqueSlug does on the server: "my-post", then "my-post-2", ...
function demoSlug(title, taken) { const base = slugify(title); for (let n = 1; ; n++) { const s = n === 1 ? base : base + '-' + n; if (!taken.has(s)) return s; } }
