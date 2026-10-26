import test from 'node:test';
import assert from 'node:assert/strict';
import { validateBooking,csv,slotTaken,validateDocuments,fileSignatureOk,fileComplete,checkUploadedFile,inviteErrorMessage } from '../lib/validation.js';
import { seedDemo,applyDemo,affiliateRows } from '../lib/demo.js';
import { calendarFile } from '../lib/calendar.js';
import { readFileSync } from 'node:fs';
import { demoSlots } from '../lib/demo.js';
import { doctors, doctorName, defaultTemplates, residencyStatuses, services, skinTechnologies, serviceOptions, serviceOptionName, shopUrl, collections, frames, brands, brandFromParam } from '../lib/config.js';
import { giftSerial,issueGiftCard,giftCode,giftNumber,bookingReference } from '../lib/gift.js';
import { demoLookup } from '../lib/demo.js';
import { featuredFirst,excerpt,EXCERPT_LENGTH } from '../lib/reviews.js';
import { lookupView,validateLookup,LOOKUP_NOT_FOUND } from '../lib/lookup.js';
import { clinic } from '../lib/config.js';
import { nullEmr,emrAdapter,applyEmr } from '../lib/emr.js';
import { calculateCommission,validateCompletion,validatePricing } from '../lib/commission.js';
import { affiliatePerformance,performanceTable,topAffiliates,filterAppointments,staffAppointmentRows,STAFF_APPOINTMENT_FIELDS } from '../lib/performance.js';
import { AFFILIATE_FIELDS,AFFILIATE_COLUMNS,restrictAffiliateRow,affiliateStats,affiliateCsvRows,AFFILIATE_CSV_FIELDS,withAffiliate } from '../lib/affiliate.js';
import { frameBrand,framePrice,reserveHref,readSavedFrames,writeSavedFrames,toggleSaved,SAVED_FRAMES_KEY,brandGroups,CLOSING_TILES,stylingHref,brandHref,directionsUrl } from '../lib/shop.js';
const patient={name:'Sample Patient',email:'sample@example.com',phone:'+14165550123',service:'eye-exam',doctor:'doctor-1',firstVisit:true,smsConsent:false,start:new Date(Date.now()+86400000).toISOString()};
// A patient booking a particular slot: that slot's optometrist and start time.
const at=slot=>({...patient,doctor:slot.doctor,start:slot.start});
test('booking validates patient details, service and future time',()=>{assert.equal(validateBooking(patient).source,'Direct');assert.equal(validateBooking({...patient,affiliateId:'ref'}).source,'Affiliate');assert.throws(()=>validateBooking({...patient,email:'invalid'}));assert.throws(()=>validateBooking({...patient,service:'emergency'}));assert.throws(()=>validateBooking({...patient,firstVisit:null}));assert.throws(()=>validateBooking({...patient,start:'2000-01-01'}));});
test('SMS requires an international-format phone number',()=>{assert.throws(()=>validateBooking({...patient,phone:'416 555 0123',smsConsent:true}));assert.equal(validateBooking({...patient,smsConsent:true}).smsConsent,true);});
test('demo bookings reject simultaneous and overlapping appointments with the same optometrist',()=>{const data=seedDemo(),slot=data.slots[1];const next=applyDemo(data,'booking',at(slot),null);assert.equal(next.bookings[0].duration,30);assert.throws(()=>applyDemo(next,'booking',at(slot),null));assert.equal(slotTaken({doctor:slot.doctor,start:new Date(new Date(slot.start).getTime()+15*60000).toISOString(),duration:30},next.bookings),true);assert.equal(slotTaken({doctor:slot.doctor,start:new Date(new Date(slot.start).getTime()+30*60000).toISOString(),duration:15},next.bookings),false);});
test('affiliate view excludes clinical and contact details',()=>{const rows=affiliateRows(seedDemo().bookings,'demo-alex');assert.ok(rows.length);for(const row of rows){for(const key of ['email','phone','service','policy','insurance','brands','doctor','giftCard','residencyStatus','documents','documentsToken','grossAmount','discountAmount','operationCost','netAmount','commissionRate'])assert.equal(key in row,false);}});
test('only staff can record valid payouts, and duplicate payment is rejected',()=>{const data=seedDemo();assert.throws(()=>applyDemo(data,'payout',{ids:['sample-2']},{role:'affiliate'}));const paid=applyDemo(data,'payout',{ids:['sample-2']},{role:'staff'});assert.equal(paid.bookings.find(b=>b.id==='sample-2').payout,'Paid');assert.throws(()=>applyDemo(paid,'payout',{ids:['sample-2']},{role:'staff'}));assert.throws(()=>applyDemo(data,'payout',{ids:['sample-1']},{role:'staff'}));});
test('inactive affiliates cannot receive bookings',()=>{let data=seedDemo();data.affiliates[0].active=false;assert.throws(()=>applyDemo(data,'booking',{...at(data.slots[1]),affiliateId:'demo-alex'},null));});
test('CSV escapes quotes and neutralises spreadsheet formulas',()=>{const output=csv([{name:'=HYPERLINK("x")',status:'Booked'}],['name','status']);assert.ok(output.includes("'="));assert.ok(output.includes('""x""'));});
test('calendar event uses UTC and the slot duration',()=>{const output=calendarFile({...patient,id:'sample',duration:45});assert.ok(output.includes('BEGIN:VEVENT'));assert.ok(output.includes('SUMMARY:Eyecon: Comprehensive eye exam with '+doctorName('doctor-1')));assert.ok(output.includes('DESCRIPTION:Your optometrist: '+doctorName('doctor-1')));assert.ok(output.includes('DTEND:'));assert.ok(output.endsWith('\r\n'));});
test('a booking without a known optometrist is rejected',()=>{assert.equal(validateBooking(patient).doctor,'doctor-1');const {doctor,...none}=patient;assert.throws(()=>validateBooking(none),/optometrist/);assert.throws(()=>validateBooking({...patient,doctor:'not-a-doctor'}),/optometrist/);assert.throws(()=>validateBooking({...patient,doctor:{slug:'doctor-1'}}),/optometrist/);const data=seedDemo(),slot=data.slots[1];assert.throws(()=>applyDemo(data,'booking',{...none,start:slot.start},null),/optometrist/);const saved=applyDemo(data,'booking',validateBooking(at(slot)),null);assert.equal(saved.bookings[0].doctor,slot.doctor);});
// A start time that every optometrist has free in the demo: their schedules overlap at some hours.
const sharedStart=data=>{const counts={};for(const s of data.slots)counts[s.start]=(counts[s.start]||0)+1;const start=data.slots.find(s=>counts[s.start]===doctors.length&&!data.bookings.some(b=>b.start===s.start)).start;return data.slots.filter(s=>s.start===start);};
test('two optometrists can be booked at the same time',()=>{const data=seedDemo(),[first,second]=sharedStart(data);assert.notEqual(first.doctor,second.doctor);const one=applyDemo(data,'booking',validateBooking(at(first)),null);assert.equal(slotTaken(second,one.bookings),false);const both=applyDemo(one,'booking',validateBooking({...at(second),email:'other@example.com'}),null);assert.deepEqual(both.bookings.slice(0,2).map(b=>b.doctor).sort(),[first.doctor,second.doctor].sort());assert.equal(both.bookings[0].start,both.bookings[1].start);});
test('the same optometrist cannot be double-booked',()=>{const data=seedDemo(),[slot]=sharedStart(data);const booked=applyDemo(data,'booking',validateBooking(at(slot)),null);assert.equal(slotTaken(slot,booked.bookings),true);assert.throws(()=>applyDemo(booked,'booking',validateBooking({...at(slot),email:'other@example.com'}),null),/just been booked/);assert.throws(()=>applyDemo(data,'booking',{...at(slot),doctor:'doctor-1',start:new Date(Date.now()+86400000*400).toISOString()},null),/just been booked/);});
test('demo availability is per optometrist, with different hours for each',()=>{const slots=demoSlots(new Date('2026-10-12T12:00:00.000Z')),by=slug=>new Set(slots.filter(s=>s.doctor===slug).map(s=>s.start));assert.ok(slots.every(s=>doctors.some(d=>d.slug===s.doctor)));const [a,b]=doctors.map(d=>by(d.slug));assert.ok(a.size&&b.size);assert.ok([...a].some(t=>!b.has(t)),'doctor-1 has times doctor-2 does not');assert.ok([...b].some(t=>!a.has(t)),'doctor-2 has times doctor-1 does not');assert.ok([...a].some(t=>b.has(t)),'some times are shared');});
test('staff add available time for a chosen optometrist',()=>{const data=seedDemo(),start=new Date(Date.now()+86400000*60).toISOString(),staff={role:'staff'};assert.throws(()=>applyDemo(data,'slot',{start,duration:30},staff),/optometrist/);const added=applyDemo(data,'slot',{doctor:'doctor-1',start,duration:30},staff);assert.throws(()=>applyDemo(added,'slot',{doctor:'doctor-1',start,duration:30},staff),/already has/);const both=applyDemo(added,'slot',{doctor:'doctor-2',start,duration:30},staff);assert.equal(both.slots.filter(s=>s.start===start).length,2);assert.throws(()=>applyDemo(data,'slot',{doctor:'doctor-1',start,duration:30},{role:'affiliate'}));});
const migration=()=>readFileSync(new URL('../supabase/migrations/004_doctor_availability.sql',import.meta.url),'utf8');
test('the confirmation message names the optometrist',()=>{assert.ok(defaultTemplates.find(t=>t.id==='confirmation').body.includes('{doctor}'));assert.ok(migration().includes("'your appointment with {doctor} is booked for'"));});
test('migration 004 keeps availability and bookings per optometrist',()=>{const sql=migration();for(const part of ['create extension if not exists btree_gist','add primary key (doctor, start)','drop index if exists public.one_active_booking_per_slot','drop constraint if exists no_overlapping_bookings;',"on public.bookings (doctor, start) where status <> 'Cancelled'",'exclude using gist (doctor with =, tstzrange(start, end_time','returns table(doctor text,','b.doctor = s.doctor','where doctor=p_doctor and start=p_start','for update',"raise exception 'doctor required'"])assert.ok(sql.includes(part),part);});
test('sample rating and insurers are never used outside demo mode, and missing samples fall back to nothing',async()=>{const {siteContent,sample}=await import('../lib/config.js');const empty={rating:null,reviewCount:null,reviews:[],mentions:[],insurers:[],goodToKnow:[]};const live=siteContent(false,empty);assert.deepEqual(live.reviews,{items:[],sample:false});assert.equal(live.rating.value,null);assert.equal(live.rating.count,null);assert.deepEqual(live.insurers.items,[]);assert.deepEqual(live.mentions.items,[]);assert.deepEqual(live.goodToKnow.items,[]);for(const part of Object.values(live))assert.equal(part.sample,false);const demo=siteContent(true,empty);assert.deepEqual(demo.reviews,{items:[],sample:false},'no sample reviews exist any more');assert.deepEqual(demo.mentions,{items:[],sample:false});assert.equal(demo.rating.value,4.9);assert.equal(demo.rating.sample,true);assert.equal(demo.insurers.sample,true);const real=[{name:'Real P.',source:'Google',text:'Real words.'}];const mixed=siteContent(true,{...empty,reviews:real,rating:4.6});assert.equal(mixed.reviews.items,real);assert.equal(mixed.reviews.sample,false);assert.equal(mixed.rating.value,4.6);assert.equal(mixed.rating.count,null);assert.equal(mixed.rating.sample,false);assert.equal('reviews' in sample,false);assert.equal('mentions' in sample,false);});
test('gift card serials use the unambiguous alphabet and cards expire 30 days after issue',()=>{for(let i=0;i<500;i++)assert.match(giftSerial(),/^[2-9A-HJ-NP-Z]{6}$/);const now=new Date('2026-10-09T15:00:00.000Z'),card=issueGiftCard(()=>false,now);assert.match(card.serial,/^[2-9A-HJ-NP-Z]{6}$/);assert.equal(card.issuedAt,'2026-10-09T15:00:00.000Z');assert.equal(card.expiresAt,'2026-11-08T15:00:00.000Z');assert.equal((new Date(card.expiresAt)-new Date(card.issuedAt))/86400000,30);assert.equal(card.status,'Issued');let calls=0;const second=issueGiftCard(()=>++calls<4);assert.equal(calls,4);assert.match(second.serial,/^[2-9A-HJ-NP-Z]{6}$/);assert.throws(()=>issueGiftCard(()=>true));assert.equal(giftCode({name:'Alex Morgan'}),'AMO');assert.equal(giftCode({name:'Alex Morgan',code:'amx'}),'AMX');assert.equal(giftCode({name:'Cher'}),'CHE');assert.equal(giftCode({name:'Jo Li'}),'JLI');assert.equal(giftNumber({name:'Alex Morgan'},'7K2M9Q'),'EYC-AMO-7K2M9Q');assert.equal(giftNumber({name:'Alex Morgan'}),'EYC-AMO-••••••');});
test('only referral bookings are issued a gift card, each with its own serial',()=>{const data=seedDemo();const direct=applyDemo(data,'booking',validateBooking(at(data.slots[1])),null);assert.equal('giftCard' in direct.bookings[0],false);const first=applyDemo(data,'booking',validateBooking({...at(data.slots[1]),affiliateId:'demo-alex'}),null),second=applyDemo(first,'booking',validateBooking({...at(data.slots[2]),affiliateId:'demo-alex'}),null);const a=first.bookings[0].giftCard,b=second.bookings[0].giftCard;assert.match(a.serial,/^[2-9A-HJ-NP-Z]{6}$/);assert.equal(a.status,'Issued');assert.equal(Math.round((new Date(a.expiresAt)-new Date(a.issuedAt))/86400000),30);assert.notEqual(a.serial,b.serial);assert.equal(new Set(second.bookings.filter(x=>x.giftCard).map(x=>x.giftCard.serial)).size,second.bookings.filter(x=>x.giftCard).length);});

// "Complete your file"
const doc=(kind,over={})=>({name:kind+'.pdf',size:2048,type:'application/pdf',kind,...over});
const filePayload=(files=[doc('government-id')])=>({residencyStatus:residencyStatuses[0],files});
test('complete your file needs a listed residency status and exactly one government ID',()=>{assert.equal(validateDocuments(filePayload()).residencyStatus,residencyStatuses[0]);assert.throws(()=>validateDocuments({...filePayload(),residencyStatus:'Citizen of nowhere'}),/residency/);assert.throws(()=>validateDocuments({...filePayload(),residencyStatus:''}),/residency/);assert.throws(()=>validateDocuments(filePayload([])),/government ID/);assert.throws(()=>validateDocuments(filePayload([doc('diploma')])),/government ID/);assert.throws(()=>validateDocuments(filePayload([doc('government-id'),doc('government-id')])),/only one/);assert.equal(validateDocuments(filePayload([doc('government-id'),doc('diploma'),doc('certificate'),doc('high-school-diploma'),doc('english-test'),doc('other')])).files.length,6);assert.throws(()=>validateDocuments(filePayload([doc('government-id'),doc('')])),/Choose what/);assert.throws(()=>validateDocuments(filePayload([doc('government-id'),doc('passport-scan')])),/Choose what/);});
test('documents are PDF, JPG or PNG, at most 10 MB each and 8 in total',()=>{assert.ok(validateDocuments(filePayload([doc('government-id',{type:'image/jpeg'}),doc('other',{type:'image/png'})])));assert.throws(()=>validateDocuments(filePayload([doc('government-id',{type:'image/webp'})])),/PDF, JPG or PNG/);assert.throws(()=>validateDocuments(filePayload([doc('government-id',{type:'text/html'})])),/PDF, JPG or PNG/);assert.ok(validateDocuments(filePayload([doc('government-id',{size:10*1024*1024})])));assert.throws(()=>validateDocuments(filePayload([doc('government-id',{size:10*1024*1024+1})])),/10 MB/);assert.throws(()=>validateDocuments(filePayload([doc('government-id',{size:0})])),/empty/);assert.equal(validateDocuments(filePayload([doc('government-id'),...Array.from({length:7},()=>doc('other'))])).files.length,8);assert.throws(()=>validateDocuments(filePayload([doc('government-id'),...Array.from({length:8},()=>doc('other'))])),/at most 8/);});
test('file signatures must match the claimed type',()=>{const pdf=Buffer.from('%PDF-1.7\n'),jpg=Buffer.from([0xff,0xd8,0xff,0xe0,0,0x10]),png=Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0,0]);assert.equal(fileSignatureOk('application/pdf',pdf),true);assert.equal(fileSignatureOk('image/jpeg',jpg),true);assert.equal(fileSignatureOk('image/png',png),true);assert.equal(fileSignatureOk('application/pdf',png),false);assert.equal(fileSignatureOk('image/png',jpg),false);assert.equal(fileSignatureOk('image/jpeg',Buffer.from('<html>')),false);assert.equal(fileSignatureOk('image/webp',Buffer.from('RIFF0000WEBP')),false);assert.equal(fileSignatureOk('application/pdf',Buffer.alloc(0)),false);});
test('demo documents keep names and sizes only, and the link works once',()=>{const data=seedDemo(),booked=applyDemo(data,'booking',validateBooking(at(data.slots[1])),null),b=booked.bookings[0];assert.ok(b.documentsToken);assert.equal(fileComplete(b),false);assert.throws(()=>applyDemo(booked,'documents',{...filePayload(),token:'wrong'},null),/expired or has already been used/);assert.throws(()=>applyDemo(booked,'documents',filePayload(),null),/expired or has already been used/);const done=applyDemo(booked,'documents',{...filePayload([{...doc('government-id'),contents:'secret bytes'},doc('diploma',{type:'image/jpeg'})]),token:b.documentsToken},null),saved=done.bookings[0];assert.equal(saved.residencyStatus,residencyStatuses[0]);assert.equal(fileComplete(saved),true);assert.equal(saved.documents.length,2);for(const d of saved.documents){assert.equal(d.demo,true);assert.deepEqual(Object.keys(d).sort(),['demo','id','kind','mime','name','size','uploadedAt']);}assert.equal(JSON.stringify(done).includes('secret bytes'),false);assert.throws(()=>applyDemo(done,'documents',{...filePayload(),token:b.documentsToken},null),/expired or has already been used/);const expired=structuredClone(booked);expired.bookings[0].documentsExpiresAt=new Date(Date.now()-1000).toISOString();assert.throws(()=>applyDemo(expired,'documents',{...filePayload(),token:b.documentsToken},null),/expired/);});
test('the confirmation message carries the documents link',()=>{assert.ok(defaultTemplates.find(t=>t.id==='confirmation').body.includes('{documents_link}'));});
test('migration 005 keeps documents private and stores only token hashes',()=>{const sql=readFileSync(new URL('../supabase/migrations/005_documents.sql',import.meta.url),'utf8');for(const part of ["values ('booking-documents', 'booking-documents', false,",'on conflict (id) do update set public = false','token_hash text not null unique','used_at timestamptz','expires_at timestamptz not null','create table public.booking_documents','booking_id uuid not null references public.bookings(id)','kind text not null','file_path text not null unique','original_name text not null','size integer not null','mime text not null','uploaded_at timestamptz not null','add column if not exists residency_status','revoke all on public.booking_document_tokens, public.booking_documents from anon, authenticated','{documents_link}'])assert.ok(sql.includes(part),part);assert.equal(/create policy/i.test(sql),false,'no storage or table policies open this data');assert.equal(/\btoken text\b/.test(sql),false,'the raw token is never stored');});

// Booking lookup (/my-booking)
const LOOKUP_KEYS=['clinicAddress','doctorName','duration','fileComplete','giftCardNumber','reference','service','serviceName','start','status'];
test('booking references are 8 characters from the gift card alphabet and unique',()=>{for(let i=0;i<300;i++)assert.match(bookingReference(),/^[2-9A-HJ-NP-Z]{8}$/);let calls=0;assert.match(bookingReference(()=>++calls<3),/^[2-9A-HJ-NP-Z]{8}$/);assert.equal(calls,3);assert.throws(()=>bookingReference(()=>true));let data=seedDemo();for(const b of data.bookings)assert.match(b.reference,/^[2-9A-HJ-NP-Z]{8}$/);for(let i=1;i<=6;i++)data=applyDemo(data,'booking',validateBooking({...at(data.slots[i]),email:`p${i}@example.com`}),null);const refs=data.bookings.map(b=>b.reference);assert.ok(refs.every(r=>/^[2-9A-HJ-NP-Z]{8}$/.test(r)));assert.equal(new Set(refs).size,refs.length);});
test('lookup needs the reference and the booking email, and gives one answer for not found and wrong email',()=>{const data=seedDemo(),b=data.bookings.find(b=>b.id==='sample-1');const found=demoLookup(data,{reference:b.reference,email:b.email});assert.equal(found.reference,b.reference);assert.deepEqual(demoLookup(data,{reference:' '+b.reference.toLowerCase().slice(0,4)+'-'+b.reference.toLowerCase().slice(4)+' ',email:b.email.toUpperCase()}).reference,b.reference);const wrongEmail=(()=>{try{demoLookup(data,{reference:b.reference,email:'someone@example.com'});}catch(e){return e.message;}})();const unknown=(()=>{try{demoLookup(data,{reference:'ZZZZZZZZ',email:b.email});}catch(e){return e.message;}})();const otherPatients=(()=>{try{demoLookup(data,{reference:b.reference,email:'sample2@example.com'});}catch(e){return e.message;}})();assert.equal(wrongEmail,LOOKUP_NOT_FOUND);assert.equal(unknown,LOOKUP_NOT_FOUND);assert.equal(otherPatients,LOOKUP_NOT_FOUND);assert.throws(()=>validateLookup({reference:'ABC',email:b.email}),/8 letters/);assert.throws(()=>validateLookup({reference:'O0I1O0I1',email:b.email}),/8 letters/);assert.throws(()=>validateLookup({reference:b.reference,email:'not-an-email'}),/email/);});
test('lookup returns only the booking card fields',()=>{const data=seedDemo();for(const b of data.bookings){const view=demoLookup(data,{reference:b.reference,email:b.email});const keys=Object.keys(view).filter(k=>k!=='documentsToken').sort();assert.deepEqual(keys,LOOKUP_KEYS);for(const key of ['email','phone','name','insurance','policy','brands','affiliateId','residencyStatus','documents','commission','payout','id'])assert.equal(key in view,false,key);}const referral=demoLookup(data,{reference:'R6HD3NVU',email:'sample4@example.com'});assert.equal(referral.giftCardNumber,'EYC-AMO-R6HD3N');assert.equal(referral.fileComplete,true);assert.equal(referral.doctorName,doctorName('doctor-2'));const direct=demoLookup(data,{reference:'H3CZ6PLE',email:'sample3@example.com'});assert.equal(direct.giftCardNumber,null);assert.equal(direct.fileComplete,false);assert.equal(direct.status,'No-show');});
test('a Complete your file link is offered only for an upcoming booking that is missing its ID',()=>{const data=seedDemo(),booked=applyDemo(data,'booking',validateBooking(at(data.slots[1])),null),b=booked.bookings[0];const open=demoLookup(booked,{reference:b.reference,email:b.email});assert.equal(open.fileComplete,false);assert.equal(open.documentsToken,b.documentsToken);const done=applyDemo(booked,'documents',{residencyStatus:residencyStatuses[0],files:[doc('government-id')],token:b.documentsToken},null);const complete=demoLookup(done,{reference:b.reference,email:b.email});assert.equal(complete.fileComplete,true);assert.equal('documentsToken' in complete,false);const cancelled=structuredClone(booked);cancelled.bookings[0].status='Cancelled';assert.equal('documentsToken' in demoLookup(cancelled,{reference:b.reference,email:b.email}),false);const past=demoLookup(data,{reference:'H3CZ6PLE',email:'sample3@example.com'});assert.equal('documentsToken' in past,false);});
test('the EMR placeholder returns null, and its data can later override status, doctor and time',async()=>{assert.equal(emrAdapter(),nullEmr);assert.equal(await nullEmr.getAppointment('7K2M9QXB'),null);assert.equal(await nullEmr.syncBooking({}),null);const view=lookupView(seedDemo().bookings[0]);assert.deepEqual(applyEmr(view,null),view);const moved=applyEmr(view,{status:'Cancelled',doctorName:'Dr. EMR Name',start:'2027-01-05T15:00:00Z',duration:45});assert.equal(moved.status,'Cancelled');assert.equal(moved.doctorName,'Dr. EMR Name');assert.equal(moved.start,'2027-01-05T15:00:00.000Z');assert.equal(moved.duration,45);const junk=applyEmr(view,{status:'Rescheduled?',doctorName:'  ',start:'not a date',duration:-5});assert.deepEqual(junk,view);});
test('the reference appears in the confirmation email and calendar event',()=>{const t=defaultTemplates.find(t=>t.id==='confirmation').body;assert.ok(t.includes('{reference}'));assert.ok(t.includes('{lookup_link}'));const ics=calendarFile({...patient,id:'uuid-1',reference:'7K2M9QXB',duration:30});assert.ok(ics.includes('UID:7K2M9QXB@eyecon-appointments'));assert.ok(ics.includes('Booking reference: 7K2M9QXB'));assert.ok(calendarFile({...patient,doctorName:'Dr. EMR Name',reference:'7K2M9QXB'}).includes('with Dr. EMR Name'));});
test('migration 006 adds unique references, a rate-limited lookup and several document links per booking',()=>{const sql=readFileSync(new URL('../supabase/migrations/006_booking_lookup.sql',import.meta.url),'utf8');for(const part of ["'23456789ABCDEFGHJKLMNPQRSTUVWXYZ'",'add column if not exists reference text','update public.bookings set reference = public.new_booking_reference() where reference is null','set default public.new_booking_reference()','alter column reference set not null',"check (reference ~ '^[2-9A-HJ-NP-Z]{8}$')",'create unique index booking_reference_unique on public.bookings(reference)','>= 10 then raise exception \'rate limit\'','where reference = upper(p_reference) and email = lower(trim(p_email))','grant execute on function public.lookup_booking(text,text,text) to service_role','drop constraint booking_document_tokens_pkey','{lookup_link}'])assert.ok(sql.includes(part),part);});

// Calculated commission: rate × (billed − operation cost), billed = gross − discount
const staff={role:'staff'};
test('the worked example: $400 billed, $200 operation cost, 10% gives $20',()=>{const c=calculateCommission({gross:400,discount:0,operationCost:200,rate:10});assert.equal(c.billed,400);assert.equal(c.net,200);assert.equal(c.commission,20);});
test('a discount lowers the amount billed, so it lowers net and commission',()=>{const full=calculateCommission({gross:400,operationCost:200,rate:10}),discounted=calculateCommission({gross:400,discount:50,operationCost:200,rate:10});assert.equal(discounted.billed,350);assert.equal(discounted.net,150);assert.equal(discounted.commission,15);assert.ok(discounted.commission<full.commission);});
test('net never goes below 0, so commission is never negative',()=>{const c=calculateCommission({gross:100,operationCost:200,rate:10});assert.equal(c.net,0);assert.equal(c.commission,0);const all=calculateCommission({gross:300,discount:300,operationCost:50,rate:25});assert.equal(all.net,0);assert.equal(all.commission,0);});
test('commission rounds to the cent, and direct bookings earn none',()=>{assert.equal(calculateCommission({gross:333.33,operationCost:0,rate:7.5}).commission,25);assert.equal(calculateCommission({gross:10.05,rate:10}).commission,1.01);assert.equal(calculateCommission({gross:0.1,discount:0,operationCost:0.03,rate:100}).net,0.07);assert.equal(calculateCommission({gross:400,operationCost:200,rate:10,hasAffiliate:false}).commission,0);});
test('staff enter a valid gross and discount; the discount cannot exceed the bill',()=>{assert.deepEqual(validateCompletion({gross:'400',discount:''}),{gross:400,discount:0});assert.throws(()=>validateCompletion({gross:'',discount:0}),/amount billed/);assert.throws(()=>validateCompletion({gross:-1}),/amount billed/);assert.throws(()=>validateCompletion({gross:100,discount:-5}),/discount/);assert.throws(()=>validateCompletion({gross:100,discount:150}),/more than the amount billed/);assert.throws(()=>validateCompletion({gross:2000000}),/amount billed/);assert.deepEqual(validatePricing({retailPrice:'120',operationCost:'45.5'}),{retailPrice:120,operationCost:45.5});assert.throws(()=>validatePricing({retailPrice:-1,operationCost:0}),/retail price/);});
test('affiliates cannot complete appointments or change pricing, and typed commission is gone',()=>{const data=seedDemo();for(const user of [{role:'affiliate',affiliateId:'demo-alex'},null]){assert.throws(()=>applyDemo(data,'complete',{id:'sample-1',gross:400,discount:0},user),/Staff access/);assert.throws(()=>applyDemo(data,'pricing',{service:'eye-exam',retailPrice:1,operationCost:0},user),/Staff access/);}assert.throws(()=>applyDemo(data,'commission',{id:'sample-2',amount:999},staff),/Unknown action/);});
test('completing an appointment calculates commission from the pricing and the affiliate rate',()=>{let data=applyDemo(seedDemo(),'pricing',{service:'eye-exam',retailPrice:400,operationCost:200},staff);assert.deepEqual(data.procedureCosts.find(p=>p.service==='eye-exam'),{...data.procedureCosts.find(p=>p.service==='eye-exam'),retailPrice:400,operationCost:200});const done=applyDemo(data,'complete',{id:'sample-1',gross:400,discount:0},staff),b=done.bookings.find(b=>b.id==='sample-1');assert.equal(b.status,'Attended');assert.equal(b.operationCost,200);assert.equal(b.netAmount,200);assert.equal(b.commissionRate,10);assert.equal(b.commission,20);const discounted=applyDemo(done,'complete',{id:'sample-1',gross:400,discount:100},staff).bookings.find(b=>b.id==='sample-1');assert.equal(discounted.commission,10);const repriced=applyDemo(applyDemo(done,'pricing',{service:'eye-exam',retailPrice:400,operationCost:350},staff),'complete',{id:'sample-1',gross:400,discount:0},staff).bookings.find(b=>b.id==='sample-1');assert.equal(repriced.operationCost,200,'the first operation cost is kept');assert.equal(repriced.commission,20);const direct=applyDemo(data,'complete',{id:'sample-3',gross:400,discount:0},staff).bookings.find(b=>b.id==='sample-3');assert.equal(direct.commission,0);assert.equal(direct.commissionRate,null);assert.throws(()=>applyDemo(data,'complete',{id:'sample-4',gross:400,discount:0},staff),/locked/);assert.throws(()=>applyDemo(data,'complete',{id:'sample-1',gross:400,discount:500},staff),/more than/);});
test('migration 007 calculates commission in the database',()=>{const sql=readFileSync(new URL('../supabase/migrations/007_commission.sql',import.meta.url),'utf8');for(const part of ['create table public.procedure_costs','retail_price numeric(12,2)','operation_cost numeric(12,2)',"('eye-exam',0,0),('contacts',0,0),('dry-eye',0,0),('children',0,0),('testing',0,0),('styling',0,0)",'gross_amount numeric(12,2)','discount_amount numeric(12,2)','net_amount numeric(12,2)','commission_rate numeric(5,2)','create function public.complete_appointment(p_id uuid, p_gross numeric, p_discount numeric, p_actor uuid)',"if b.payout = 'Paid' then raise exception 'paid bookings are locked'",'v_net := greatest(v_gross - v_discount - v_cost, 0)','when b.affiliate_id is null then 0 else round(v_net * v_rate / 100, 2)',"status = 'Attended'","insert into audit_logs(actor_id, action, record_id) values (p_actor, 'complete_appointment'",'grant execute on function public.complete_appointment(uuid,numeric,numeric,uuid) to service_role'])assert.ok(sql.includes(part),part);});

// The affiliate workspace's restricted view
const FORBIDDEN=['gross_amount','discount_amount','operation_cost','net_amount','commission_rate','grossAmount','discountAmount','operationCost','netAmount','commissionRate','email','phone','service','insurance','policy','policy_encrypted','documents','residencyStatus','residency_status','documentsToken','brands','doctor','giftCard','gift_serial','affiliateId','affiliate_id','reference'];
test('affiliate rows never contain procedure amounts, contact details, service, insurance or documents',()=>{let data=seedDemo();data=applyDemo(data,'pricing',{service:'eye-exam',retailPrice:400,operationCost:200},staff);data=applyDemo(data,'complete',{id:'sample-1',gross:400,discount:25},staff);const rows=affiliateRows(data.bookings,'demo-alex');assert.ok(rows.length>=3);assert.ok(data.bookings.find(b=>b.id==='sample-1').grossAmount>0,'the source booking does carry amounts');for(const row of rows){assert.deepEqual(Object.keys(row).sort(),[...AFFILIATE_FIELDS].sort());for(const key of FORBIDDEN)assert.equal(key in row,false,key);}const dbRow={id:'x',name:'Sample P.',status:'Attended',start:'2026-10-01T15:00:00Z',commission:'20.00',payout:'Pending',paid_at:null,email:'a@example.com',phone:'+1',service:'eye-exam',insurance:'X',policy_encrypted:'enc',gross_amount:'400',discount_amount:'0',operation_cost:'200',net_amount:'200',commission_rate:'10',residency_status:'[x]',affiliate_id:'a',reference:'7K2M9QXB',documents:[{}]};const safe=restrictAffiliateRow(dbRow);assert.deepEqual(Object.keys(safe).sort(),[...AFFILIATE_FIELDS].sort());assert.equal(safe.commission,20);for(const key of FORBIDDEN)assert.equal(key in safe,false,key);});
test('the live affiliate query selects only the agreed columns',()=>{assert.equal(AFFILIATE_COLUMNS,'id,name,status,start,commission,payout,paid_at');for(const key of FORBIDDEN)assert.equal(AFFILIATE_COLUMNS.split(',').includes(key),false,key);const route=readFileSync(new URL('../app/api/workspace/route.js',import.meta.url),'utf8');const branch=route.slice(route.indexOf("if(u.role==='affiliate'){"),route.indexOf('requireStaff(u);'));assert.ok(branch.includes(".from('bookings').select(AFFILIATE_COLUMNS)"));assert.ok(branch.includes('bookings:b.data.map(restrictAffiliateRow)'));for(const t of ['booking_documents','procedure_costs',"select('*').eq('affiliate_id'"])assert.equal(branch.includes(t),false,t);});
test('booked referrals are excluded from completed counts and earnings',()=>{const now=new Date('2026-10-14T12:00:00Z'),row=(status,start,commission=0,payout='Pending')=>({id:status+start,name:'P',status,start,commission,payout,paidAt:null});const rows=[row('Attended','2026-10-03T15:00:00Z',20),row('Attended','2026-09-10T15:00:00Z',30,'Paid'),row('Booked','2026-10-20T15:00:00Z',99),row('Booked','2026-10-05T15:00:00Z',5),row('No-show','2026-10-06T15:00:00Z',7),row('Cancelled','2026-10-21T15:00:00Z')];const st=affiliateStats(rows,now);assert.equal(st.completedThisMonth,1);assert.equal(st.completedAllTime,2);assert.equal(st.upcoming,1);assert.equal(st.earned,50);assert.equal(st.paid,30);assert.equal(st.awaitingPayment,20);const csvRows=affiliateCsvRows(rows);for(const r of csvRows)assert.deepEqual(Object.keys(r),AFFILIATE_CSV_FIELDS);assert.equal(csvRows[0].yourCommission,'20.00');assert.equal(csvRows[2].yourCommission,'');assert.equal(csvRows[4].yourCommission,'');});

// Staff affiliate performance dashboard
const perfNow=new Date('2026-10-14T12:00:00Z');
const perfBooking=(id,affiliateId,status,start,extra={})=>({id,affiliateId,name:'P '+id,email:id+'@example.com',phone:'+1',service:'eye-exam',doctor:'doctor-1',source:'Affiliate',status,start,commission:0,payout:'Pending',paidAt:null,grossAmount:null,discountAmount:null,operationCost:null,netAmount:null,commissionRate:null,...extra});
const perfAffiliates=[{id:'a1',name:'Avery',slug:'avery'},{id:'a2',name:'Blake',slug:'blake'},{id:'a3',name:'Casey',slug:'casey'}];
const perfBookings=[
  perfBooking('1','a1','Attended','2026-10-02T15:00:00Z',{grossAmount:400,discountAmount:0,operationCost:200,netAmount:200,commissionRate:10,commission:20}),
  perfBooking('2','a1','Attended','2026-09-12T15:00:00Z',{grossAmount:500,discountAmount:50,operationCost:150,netAmount:300,commissionRate:10,commission:30,payout:'Paid',paidAt:'2026-09-30T15:00:00Z'}),
  perfBooking('3','a1','Booked','2026-10-20T15:00:00Z'),
  perfBooking('4','a1','No-show','2026-10-05T15:00:00Z'),
  perfBooking('5','a2','Attended','2026-10-06T15:00:00Z',{grossAmount:1000,discountAmount:100,operationCost:100,netAmount:800,commissionRate:10,commission:80}),
  perfBooking('6','a2','Attended','2026-10-08T15:00:00Z',{grossAmount:300,discountAmount:0,operationCost:100,netAmount:200,commissionRate:10,commission:20}),
  perfBooking('7',null,'Attended','2026-10-06T15:00:00Z',{grossAmount:999,commission:0})
];
test('affiliate performance counts completed referrals, billed amounts and commission by payout',()=>{const a=affiliatePerformance(perfAffiliates[0],perfBookings,perfNow);assert.equal(a.total,4);assert.equal(a.completed,2);assert.equal(a.upcoming,1);assert.equal(a.billed,850,'(400 − 0) + (500 − 50), completed referrals only');assert.equal(a.pending,20);assert.equal(a.paid,30);assert.equal(a.completedThisMonth,1);assert.equal(a.commissionThisMonth,20);const c=affiliatePerformance(perfAffiliates[2],perfBookings,perfNow);assert.deepEqual([c.total,c.completed,c.upcoming,c.billed,c.pending,c.paid],[0,0,0,0,0,0]);});
test('the affiliates table sorts by completed and by commission',()=>{const names=sort=>performanceTable(perfAffiliates,perfBookings,sort,perfNow).map(p=>p.affiliate.name);assert.deepEqual(names({key:'completed',dir:'desc'}),['Avery','Blake','Casey']);assert.deepEqual(names({key:'completed',dir:'asc'}),['Casey','Avery','Blake']);assert.deepEqual(names({key:'pending',dir:'desc'}),['Blake','Avery','Casey']);assert.deepEqual(names({key:'paid',dir:'desc'}),['Avery','Blake','Casey']);assert.deepEqual(names({key:'commission',dir:'desc'}),['Blake','Avery','Casey']);});
test('top affiliates this month ranks by completed referrals, then commission',()=>{const top=topAffiliates(perfAffiliates,perfBookings,perfNow);assert.deepEqual(top.map(p=>[p.affiliate.name,p.completedThisMonth,p.commissionThisMonth]),[['Blake',2,100],['Avery',1,20]]);assert.deepEqual(topAffiliates(perfAffiliates,perfBookings,new Date('2027-03-01T12:00:00Z')),[]);});
test('appointment filters use an inclusive date range and status',()=>{const own=perfBookings.filter(b=>b.affiliateId==='a1');assert.deepEqual(filterAppointments(own,{from:'2026-10-01',to:'2026-10-05'}).map(b=>b.id),['1','4']);assert.deepEqual(filterAppointments(own,{from:'2026-10-02',to:'2026-10-02'}).map(b=>b.id),['1']);assert.deepEqual(filterAppointments(own,{status:'Attended'}).map(b=>b.id),['1','2']);assert.deepEqual(filterAppointments(own,{from:'2026-10-01',status:'Booked'}).map(b=>b.id),['3']);assert.equal(filterAppointments(own,{}).length,4);});
test('the staff appointment CSV carries every staff field, amounts included',()=>{const [row]=staffAppointmentRows([perfBookings[1]]);assert.deepEqual(Object.keys(row),STAFF_APPOINTMENT_FIELDS);assert.equal(row.gross,'500.00');assert.equal(row.discount,'50.00');assert.equal(row.billed,'450.00');assert.equal(row.operationCost,'150.00');assert.equal(row.net,'300.00');assert.equal(row.rate,'10');assert.equal(row.commission,'30.00');assert.equal(row.email,'2@example.com');assert.equal(row.service,'Comprehensive eye exam');const [open]=staffAppointmentRows([perfBookings[2]]);assert.equal(open.gross,'');assert.equal(open.billed,'');});
test('preview as affiliate shows only the restricted rows',()=>{const rows=affiliateRows(perfBookings,'a1');assert.equal(rows.length,4);for(const row of rows)assert.deepEqual(Object.keys(row).sort(),[...AFFILIATE_FIELDS].sort());});

// Non-Invasive Skin Tightening, its technologies, and Shop frames
test('skin tightening is a service with bracketed placeholder content, an icon and a neutral image',()=>{const st=services.find(s=>s.id==='skin-tightening');assert.ok(st);assert.equal(st.name,'Non-Invasive Skin Tightening');for(const text of [st.description,st.meta,...st.points])assert.match(text,/\[[^\]]+\]/,text);assert.equal(st.icon,'skin');assert.ok(readFileSync(new URL('../components/ui.js',import.meta.url),'utf8').includes('skin:<>'));assert.ok(readFileSync(new URL('../public/images/services/skin-tightening.webp',import.meta.url)).subarray(8,12).toString()==='WEBP');});
test('skin technologies are three bracketed placeholders with unique slugs',()=>{assert.equal(skinTechnologies.length,3);assert.equal(new Set(skinTechnologies.map(t=>t.slug)).size,3);for(const t of skinTechnologies){assert.match(t.slug,/^[a-z0-9]+(-[a-z0-9]+)*$/);for(const k of ['name','summary','session'])assert.match(t[k],/\[[^\]]+\]/,k);assert.ok(t.image.startsWith('/images/'));}assert.equal(serviceOptions['skin-tightening'],skinTechnologies);assert.equal(serviceOptionName('skin-tightening','technology-2'),'[Technology two]');assert.equal(serviceOptionName('eye-exam','technology-2'),'');});
test('a technology is optional, kept only for skin tightening, and saved with the booking',()=>{const skin={...patient,service:'skin-tightening'};assert.equal(validateBooking(skin).serviceOption,null);assert.equal(validateBooking({...skin,serviceOption:'technology-1'}).serviceOption,'technology-1');assert.equal(validateBooking({...skin,serviceOption:'laser-9000'}).serviceOption,null);assert.equal(validateBooking({...patient,serviceOption:'technology-1'}).serviceOption,null,'not kept for another service');const data=seedDemo();const saved=applyDemo(data,'booking',validateBooking({...at(data.slots[1]),service:'skin-tightening',serviceOption:'technology-3'}),null).bookings[0];assert.equal(saved.service,'skin-tightening');assert.equal(saved.serviceOption,'technology-3');assert.ok(seedDemo().procedureCosts.some(p=>p.service==='skin-tightening'));for(const key of ['serviceOption','service_option'])assert.equal(key in restrictAffiliateRow({...saved,service_option:'technology-3'}),false);});
// Phone header: menu button, centred logo, and a drawer with Book, Shop Frames, the phone and the location
test('on phones the header is a menu button and a centred logo, and the drawer holds Book, Shop Frames, phone and location',()=>{
  const read=f=>readFileSync(new URL(f,import.meta.url),'utf8');
  const ui=read('../components/ui.js'),css=read('../app/site.css');
  const menu=ui.slice(ui.indexOf('function MobileMenu'),ui.indexOf('export function Header'));
  for(const part of ['href={bookingHref}','href={shopHref}','>Shop Frames<','clinic.phoneHref','google.com/maps/search/?api=1&query=','Phone to be confirmed','Address to be confirmed','aria-label="Close menu"','showModal()'])assert.ok(menu.includes(part),part);
  const header=ui.slice(ui.indexOf('export function Header'),ui.indexOf('export function PreviewBar'));
  assert.ok(header.indexOf('className="menu-toggle"')<header.indexOf('<Logo/>'),'menu button sits left of the logo');
  assert.ok(header.indexOf('</header>')<header.indexOf('<MobileMenu'),'drawer sits outside the header so the overlay never tints it');
  assert.match(css,/@media \(max-width: 640px\) \{\s*\.site-header \.header-inner \{ display: grid; grid-template-columns: 84px 1fr 84px;[^}]*\}\s*\.site-header \.header-actions \{ display: none; \}/);
  assert.ok(css.includes('.site-header .logo { justify-self: center;'));
  assert.ok(ui.includes(',pin:<>'),'location pin icon');
});
test('on phones the right of the header has search and a shopping bag that goes to Shop Frames',()=>{
  const read=f=>readFileSync(new URL(f,import.meta.url),'utf8');
  const ui=read('../components/ui.js'),css=read('../app/site.css');
  const header=ui.slice(ui.indexOf('export function Header'),ui.indexOf('export function PreviewBar'));
  assert.ok(header.indexOf('<Logo/>')<header.indexOf('className="header-icons"'),'icons sit right of the logo');
  for(const part of ['aria-label="Search"','aria-controls="site-search"','<Link className="icon-link" href={shopHref} aria-label="Shop Frames"><Icon name="bag"','<SiteSearch'])assert.ok(header.includes(part),part);
  assert.ok(css.includes('.menu-toggle, .menu-spacer, .header-icons { display: none; }'),'wider screens never show the phone icons');
  assert.ok(css.includes('grid-template-columns: 84px 1fr 84px;'),'equal outer columns keep the logo centred');
});
test('on phones the hero line under the buttons is fine print, a little smaller again',()=>{
  const read=f=>readFileSync(new URL(f,import.meta.url),'utf8');
  assert.ok(read('../components/landing.js').includes('<p className="hero-rating hero-fineprint">Book online in under a minute.</p>'));
  assert.ok(read('../app/site.css').includes('  .hero-rating.hero-fineprint { font-size: .72rem; }'));
});
test('tablets and desktops have Search first in the header row, opening the same panel, and Escape closes it',()=>{
  const read=f=>readFileSync(new URL(f,import.meta.url),'utf8');
  const ui=read('../components/ui.js'),css=read('../app/site.css');
  const header=ui.slice(ui.indexOf('export function Header'),ui.indexOf('export function PreviewBar'));
  const actions=header.slice(header.indexOf('className="header-actions"'));
  assert.ok(actions.indexOf('search-link')<actions.indexOf('shop-link'),'Search sits before Shop Frames');
  assert.ok(actions.includes('<Icon name="search" size={18}/><span>Search</span>'));
  const search=ui.slice(ui.indexOf('function SiteSearch'),ui.indexOf('export function Header'));
  assert.ok(!search.includes('min-width: 641px'),'the panel is not limited to phones');
  assert.ok(search.includes("if(e.key==='Escape'){e.preventDefault();onClose();}"));
  assert.ok(css.includes('@media (min-width: 641px) { .menu-drawer { display: none; } }'));
  assert.ok(css.includes('.search-inner { max-width: 760px; margin: 0 auto;'));
});
test('site search finds houses, frames, services and pages, ignoring case and accents, and keeps the referral',async()=>{
  const { searchSite }=await import('../lib/search.js');
  assert.deepEqual(searchSite('  '),[]);
  const cartier=searchSite('CARTIER');
  assert.equal(cartier[0].title,'Cartier');assert.equal(cartier[0].group,'Houses');assert.equal(cartier[0].href,'/shop/cartier');
  assert.ok(cartier.some(r=>r.group==='Frames'&&r.title==='Cartier Santos'&&r.href==='/shop/cartier'));
  const exam=searchSite('eye exam');
  assert.equal(exam[0].href,'/booking?service=eye-exam');
  assert.ok(searchSite('CHILDRÉN').some(r=>r.title==='Children’s eye exam'),'accents and case are ignored');
  assert.equal(searchSite('exam',{bookingHref:'/booking?affiliate=alex'})[0].href,'/booking?affiliate=alex&service=eye-exam');
  assert.equal(searchSite('cartier',{affiliate:'alex'})[0].href,'/shop/cartier?affiliate=alex');
  assert.equal(searchSite('cartier',{affiliate:'not a slug'})[0].href,'/shop/cartier');
  assert.deepEqual(searchSite('zzzz-nothing'),[]);
  assert.ok(searchSite('find booking').some(r=>r.href==='/my-booking'));
  for(const r of searchSite('frames'))assert.deepEqual(Object.keys(r).sort(),['group','href','sub','title']);
});
// Shop Frames page
test('Shop frames points at the /shop page by default, from the header and under the carousel',()=>{
  const read=f=>readFileSync(new URL(f,import.meta.url),'utf8');
  assert.equal(shopUrl,'/shop');
  const ui=read('../components/ui.js'),landing=read('../components/landing.js'),css=read('../app/site.css');
  const header=ui.slice(ui.indexOf('export function Header'),ui.indexOf('export function PreviewBar'));
  assert.ok(header.indexOf('shop-link')<header.indexOf('clinic.phoneHref'),'Shop Frames sits before the phone link');
  for(const part of ['<Icon name="bag" size={18}/><span className="shop-long">','>Shop Frames<','>Frames<','href={shopHref}'])assert.ok(header.includes(part),part);
  assert.match(css,/@media \(max-width: 639px\) \{\s*\.shop-link \.shop-long \{ display: none; \}\s*\.shop-link \.shop-short \{ display: inline; \}/);
  assert.ok(css.includes('  .header-actions .shop-link { gap: .3rem; }'),'bag icon sits closer to Frames on small phones so the header fits at 360px');
  assert.ok(landing.includes('className="collections-more"')&&landing.includes('Shop all frames'));
  assert.ok(css.includes('/* Shop */'));
});
test('the Shop page has its own title, heading and components file',()=>{
  const read=f=>readFileSync(new URL(f,import.meta.url),'utf8');
  const page=read('../app/shop/page.js'),shop=read('../components/shop.js');
  assert.ok(page.includes("title:{absolute:'Shop Frames · Eyecon Optometry'}"));
  for(const part of ['>The boutique<','>Frames</h1>','Featured pieces and the houses we carry. Reserve any frame to try at your visit.','<Header','<Footer'])assert.ok(shop.includes(part),part);
  assert.ok(!read('../components/landing.js').includes('shop-heading'),'shop components stay out of landing.js');
});
test('collections are in boutique order, each with a tagline, a two-sentence blurb and a layout',()=>{
  assert.deepEqual(collections.map(c=>c.slug+':'+c.layout),['cartier:banner','chrome-hearts:banner','gucci:tile','lindberg:tile','dita:tile','tom-ford:banner','maybach:banner','maui-jim:tile','ray-ban:tile','oakley:tile','dior:banner','tiffany-and-co:banner','prada:tile','versace:tile','celine:tile','bottega-veneta:tile']);
  assert.deepEqual(brands,collections.map(c=>c.name));
  for(const c of collections){assert.ok(c.line&&c.tagline,c.slug);assert.equal(c.blurb.match(/[.!?](\s|$)/g)?.length,2,c.slug+' blurb');}
});
test('sample frames belong to known brands, have unique slugs and no price until one is filled in',()=>{
  assert.deepEqual(frames.map(f=>f.slug),['cartier-santos','chrome-hearts-bone-prone-ii','lindberg-strip-titanium','tom-ford-square-acetate','dita-mach-one','maybach-the-artist-i']);
  const slugs=new Set(collections.map(c=>c.slug));
  for(const f of frames){assert.ok(slugs.has(f.brand),f.slug);assert.deepEqual(Object.keys(f).sort(),['brand','isNew','material','model','price','slug']);assert.equal(f.price,'');assert.equal(typeof f.isNew,'boolean');}
  assert.match(readFileSync(new URL('../lib/config.js',import.meta.url),'utf8'),/SAMPLE FRAMES: replace these with frames Eyecon actually stocks/);
});
test('Reserve to try books a styling visit for the frame’s brand, keeping the affiliate',()=>{
  const santos=frames.find(f=>f.slug==='cartier-santos'),bone=frames.find(f=>f.slug==='chrome-hearts-bone-prone-ii');
  assert.equal(reserveHref(santos),'/booking?service=styling&brand=Cartier');
  assert.equal(reserveHref(bone,'alex-morgan'),'/booking?service=styling&brand=Chrome%20Hearts&affiliate=alex-morgan');
  for(const f of frames)assert.ok(brands.includes(frameBrand(f).name),'the booking flow knows '+f.brand);
  assert.ok(readFileSync(new URL('../components/shop.js',import.meta.url),'utf8').includes('href={reserveHref(frame, affiliate)}'));
});
test('a frame price shows only once filled in',()=>{
  assert.equal(framePrice(''),'');assert.equal(framePrice('  '),'');assert.equal(framePrice(undefined),'');
  assert.equal(framePrice('1250'),'$1,250.00');assert.equal(framePrice('From $900'),'From $900');
  assert.match(readFileSync(new URL('../components/shop.js',import.meta.url),'utf8'),/\{price && <p className="frame-price">/);
});
test('saved frames never throw, whatever the browser storage does',()=>{
  const store=(value)=>{const s={v:value,getItem:()=>s.v,setItem:(k,v)=>{s.v=v;}};return s;};
  const throwing={getItem(){throw new Error('blocked');},setItem(){throw new Error('quota');}};
  assert.deepEqual(readSavedFrames(store(null)),[]);assert.deepEqual(readSavedFrames(store('{bad')),[]);assert.deepEqual(readSavedFrames(store('{"a":1}')),[]);
  assert.deepEqual(readSavedFrames(store('["dita-mach-one",3]')),['dita-mach-one']);
  assert.deepEqual(readSavedFrames(throwing),[]);assert.deepEqual(readSavedFrames(null),[]);assert.equal(writeSavedFrames(throwing,['x']),false);
  const s=store(null);assert.equal(writeSavedFrames(s,['dita-mach-one']),true);assert.equal(s.getItem(SAVED_FRAMES_KEY),'["dita-mach-one"]');
  assert.deepEqual(toggleSaved(['a'],'b'),['a','b']);assert.deepEqual(toggleSaved(['a','b'],'a'),['b']);
  const shop=readFileSync(new URL('../components/shop.js',import.meta.url),'utf8');
  assert.ok(shop.includes('try { return window.localStorage; } catch { return null; }'));assert.ok(shop.includes('aria-pressed={saved}'));
});
test('Featured this week: sample label in demo only, arrows and keys, phone and reduced-motion rules',()=>{
  const read=f=>readFileSync(new URL(f,import.meta.url),'utf8');
  const shop=read('../components/shop.js'),css=read('../app/site.css');
  for(const part of ['>Featured this week<','{DEMO && <span className="featured-sample">Sample selection</span>}',"'/images/shop/frames/' + frame.slug + '.webp'",'Photograph to follow','{frame.isNew && <span className="frame-new">New</span>}','disabled={ends.start}','disabled={ends.end}',"e.key === 'ArrowRight'","reducedMotion() ? 'auto' : 'smooth'"])assert.ok(shop.includes(part),part);
  assert.ok(read('../components/landing.js').includes("import Photo from './photo';"),'one shared Photo component');
  assert.match(css,/@media \(hover: none\) \{ \.frame-reserve \{ opacity: 1;/);
  assert.match(css,/@media \(max-width: 640px\) \{[^}]*\}\s*\.featured-arrows \{ display: none; \}\s*\.frame-row \{ --gap: \.9rem; --card: 66vw; margin-inline: calc\(50% - 50vw\); padding-inline: 16px;/);
  assert.match(css,/@media \(prefers-reduced-motion: reduce\) \{\s*\.frame-row \{ scroll-behavior: auto; \}\s*\.frame-reserve, \.frame-save \{ transition: none; \}/);
});
test('the houses follow collections: banners alone, tiles in rows of three, closing tiles fill and end the page',()=>{
  const shape=groups=>groups.map(g=>g.type+':'+g.items.map(i=>i.closing?'+'+i.closing:i.slug).join(','));
  assert.deepEqual(shape(brandGroups()),['banner:cartier','banner:chrome-hearts','tiles:gucci,lindberg,dita','banner:tom-ford','banner:maybach','tiles:maui-jim,ray-ban,oakley','banner:dior','banner:tiffany-and-co','tiles:prada,versace,celine','tiles:bottega-veneta,+styling,+visit']);
  const groups=brandGroups();
  assert.deepEqual(groups.map(g=>g.type==='banner'?'B':'T'+g.items.length).join(' '),'B B T3 B B T3 B B T3 T3','pairs of banners between full rows of three');
  assert.ok(groups.slice(0,-1).every(g=>g.type==='banner'||g.items.every(i=>!i.closing)),'no short or filled row mid-page');
  const b=slug=>({slug,layout:'banner'}),t=slug=>({slug,layout:'tile'});
  assert.deepEqual(shape(brandGroups([b('a')])),['banner:a','tiles:+styling,+visit'],'always closes the page');
  assert.deepEqual(shape(brandGroups([t('a'),t('b'),t('c'),t('d'),b('e')])),['tiles:a,b,c','tiles:d,+styling,+visit','banner:e','tiles:+styling,+visit'],'four tiles make a full row and a filled one');
  assert.deepEqual(shape(brandGroups([t('a'),t('b'),t('c')])),['tiles:a,b,c','tiles:+styling,+visit']);
  assert.deepEqual(shape(brandGroups([t('a'),t('b')])),['tiles:a,b,+styling','tiles:+visit'],'a short last row still ends with both');
  assert.deepEqual(shape(brandGroups([])),['tiles:+styling,+visit']);
  assert.deepEqual(CLOSING_TILES,['styling','visit']);
});
test('house links: brand pages and Book now keep the affiliate; directions only with an address',()=>{
  assert.equal(brandHref('cartier','alex-morgan'),'/shop/cartier?affiliate=alex-morgan');assert.equal(brandHref('cartier'),'/shop/cartier');
  assert.equal(stylingHref('alex-morgan'),'/booking?service=styling&affiliate=alex-morgan');assert.equal(stylingHref(),'/booking?service=styling');
  assert.equal(directionsUrl(''),'');assert.equal(directionsUrl(undefined),'');
  assert.equal(directionsUrl('1 King St W, Toronto'),'https://www.google.com/maps/search/?api=1&query=1%20King%20St%20W%2C%20Toronto');
  const shop=readFileSync(new URL('../components/shop.js',import.meta.url),'utf8');
  for(const part of ['Try pieces from every house with a personal styling consultation.','<Button href={stylingHref(affiliate)}>Book now</Button>','Address to be confirmed','{directions && <a','>Get directions<','href={brandHref(brand.slug, affiliate)}>Shop the collection','>Discover<'])assert.ok(shop.includes(part),part);
});
test('house photographs: art-directed banners, brand photos on tiles and phones, fallback and alt text',()=>{
  const read=f=>readFileSync(new URL(f,import.meta.url),'utf8');
  const shop=read('../components/shop.js'),photo=read('../components/photo.js'),css=read('../app/site.css').replace(/\r\n/g,'\n');
  for(const part of ["'/images/shop/banners/' + brand.slug","art + '-desktop.webp'","mobile={'/images/brands/' + brand.slug + '.webp'}","'/images/brands/' + brand.slug + '.webp'",'<BrandPhoto brand={brand} sizes="(max-width: 640px) 78vw, 33vw" />'])assert.ok(shop.includes(part),part);
  assert.ok(!shop.includes('shop/tiles')&&!shop.includes("art + '-mobile.webp'"),'tiles and phone banners use the brand photo');
  assert.equal((shop.match(/alt=\{brand\.name \+ ' eyewear'\}/g)||[]).length,2,'banner and brand photo alt');
  assert.ok(photo.includes('<source media="(max-width: 640px)" srcSet={narrow} />')&&photo.includes('onError={fail}'));
  for(const c of collections)assert.ok(readFileSync(new URL('../public/images/brands/'+c.slug+'.webp',import.meta.url)).length>0,c.slug+' brand photo exists');
  for(const c of collections.filter(c=>c.layout==='banner'))assert.ok(readFileSync(new URL('../public/images/shop/banners/'+c.slug+'-desktop.webp',import.meta.url)).length>0,c.slug+' desktop banner exists');
  for(const f of ['../components/shop.js','../components/landing.js'])assert.ok(read(f).includes('<small>Photograph to follow</small></span></Photo>'),f+' shows the placeholder while a photograph is missing');
  assert.ok(css.includes('aspect-ratio: 16 / 9; max-height: 80vh;'));
  assert.ok(css.includes('.houses { display: flex; flex-direction: column; gap: 0;'),'banners touch each other and the tile row below');
  assert.ok(css.includes('.houses .house-row { padding-block: clamp(40px, 4vw, 64px); }\n.houses .house-row + .house-row { padding-top: 0; }'),'room above and below each tile row, one gap between two rows');
  assert.match(css,/@media \(max-width: 640px\) \{[^}]*\.houses \.house-row \{ padding-block: 32px; \}/,'32px on phones');
  assert.ok(!/\.shop-banner \+ \.shop-banner|\.shop-banner \{[^}]*margin: (?!0;)/.test(css),'banners still touch');
  assert.ok(css.includes('.house-tiles { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: clamp(16px, 1.5vw, 24px);'),'desktop gutter about 1.5vw, never more than 24px');
  assert.ok(css.includes('.house-tiles { display: flex; gap: 12px; padding-inline: 16px;'),'phone swipe row gutter 12px');
  assert.ok(css.includes('.house-row { width: min(1250px, calc(100% - 3rem)); margin-inline: auto; }'),'tile rows centred at the page content width');
  assert.match(css,/@media \(max-width: 640px\) \{\s*\.houses[^}]*\}[\s\S]*?\.shop-banner-media \{ aspect-ratio: 4 \/ 5; max-height: none; \}[\s\S]*?\.shop-banner-text \{ position: static;[\s\S]*?\.house-tile \{ flex: 0 0 74vw;/);
  assert.match(css,/@media \(prefers-reduced-motion: reduce\) \{\s*\.house-media img \{ transition: none; \}/);
  assert.ok(css.includes('.frame-card { position: relative;')&&css.includes('.house-tile { position: relative;'),'cards contain their screen-reader labels, so a scroll row never widens the page');
});
test('brand pages: every brand built ahead, unknown slugs not found, own title, affiliate read in the browser',()=>{
  const read=f=>readFileSync(new URL(f,import.meta.url),'utf8');
  const page=read('../app/shop/[slug]/page.js'),shop=read('../components/shop.js');
  assert.ok(page.includes('export const dynamicParams=false;'));
  assert.ok(page.includes('export function generateStaticParams(){return collections.map(c=>({slug:c.slug}));}'));
  assert.ok(page.includes('notFound()')&&page.includes('title:{absolute:`${brand.name} · Shop Frames · Eyecon Optometry`}'));
  assert.ok(!page.includes('searchParams'),'reading searchParams on the server would stop the pages being built ahead');
  for(const part of ["<Suspense fallback={<BrandPageBody brand={brand} affiliate={null} />}>","useSearchParams().get('affiliate')","href={withAffiliate('/shop', affiliate)}>","All frames</Link>",'<Banner brand={brand} page />','{brand.blurb}','New pieces arriving soon. Book a styling visit to see the full collection in person.','Want to try {brand.name} in person?','<Button href={stylingHref(affiliate, brand.name)}>Book a styling visit</Button>','<FrameCard key={f.slug}'])assert.ok(shop.includes(part),part);
  assert.ok(shop.includes("{!page && <Button className=\"outline\""),'no button on the brand page banner');
  const css=read('../app/site.css');
  assert.ok(css.includes('.frame-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr));'));
  assert.ok(css.includes('@media (max-width: 1024px) { .frame-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }'));
  assert.deepEqual(collections.filter(c=>!frames.some(f=>f.brand===c.slug)).map(c=>c.slug),['gucci','maui-jim','ray-ban','oakley','dior','tiffany-and-co','prada','versace','celine','bottega-veneta'],'these brands show the arriving-soon line');
});
test('a booking link’s ?brand= preselects that brand for every house',()=>{
  for(const c of collections){
    const link=new URL(stylingHref('alex-morgan',c.name),'http://localhost');
    assert.equal(brandFromParam(link.searchParams.get('brand')),c.name,c.name);
    assert.equal(brandFromParam(c.name.toUpperCase()),c.name);assert.equal(brandFromParam(' '+c.name.toLowerCase()+' '),c.name);
  }
  for(const bad of [null,undefined,'','Persol','cartierx'])assert.equal(brandFromParam(bad),'',String(bad));
  assert.ok(readFileSync(new URL('../components/booking-flow.js',import.meta.url),'utf8').includes("const linkedBrand = brandFromParam(params.get('brand'));"));
});
test('Shop Frames phone polish: 44px targets, focus rings with room, focus brings the card into its snap place',()=>{
  const read=f=>readFileSync(new URL(f,import.meta.url),'utf8');
  const css=read('../app/site.css'),shop=read('../components/shop.js');
  for(const part of ['.frame-reserve, .house-link, .brand-back .text-link, .collections-more .text-link { display: inline-block; min-height: 44px; padding-block: 10px; background-origin: content-box;','.site-header .shop-link { min-height: 44px; }','.logo { min-height: 44px;','.footer-col a { display: inline-flex; align-items: center; min-height: 44px; }','.preview-bar a { display: inline-flex; align-items: center; min-height: 44px; margin-block: -12px; }','.frame-row { padding: 8px; margin: -8px; scroll-padding-inline: 8px; }','.frame-row { margin: -8px calc(50% - 50vw); padding: 8px 16px; scroll-padding-inline: 16px; }','.closing-panel.dark :focus-visible, .final-cta :focus-visible { outline-color: #fff; }'])assert.ok(css.includes(part),part);
  assert.equal((shop.match(/onFocus=\{revealCard\}/g)||[]).length,2,'both swipe rows');
  assert.ok(shop.includes("card.scrollIntoView({ block: 'nearest', inline: 'start', behavior: reducedMotion() ? 'auto' : 'smooth' });"));
});
test('withAffiliate carries a well-formed affiliate onto every shop booking link',()=>{
  assert.equal(withAffiliate('/booking','alex-morgan'),'/booking?affiliate=alex-morgan');
  assert.equal(withAffiliate('/booking?service=styling','alex-morgan'),'/booking?service=styling&affiliate=alex-morgan');
  assert.equal(withAffiliate('/#collections','alex-morgan'),'/?affiliate=alex-morgan#collections');
  assert.equal(withAffiliate('/shop',['alex-morgan','other']),'/shop?affiliate=alex-morgan');
  for(const bad of [undefined,'','Alex','a--b','x"><script>','a'.repeat(71)])assert.equal(withAffiliate('/booking',bad),'/booking',String(bad));
  const shop=readFileSync(new URL('../components/shop.js',import.meta.url),'utf8');
  assert.ok(shop.includes("bookingHref={withAffiliate('/booking', affiliate)}"));
  assert.equal((shop.match(/\/booking/g)||[]).length,(shop.match(/withAffiliate\('\/booking/g)||[]).length,'no booking link without the affiliate');
});
test('migration 008 allows skin tightening and adds the service option',()=>{const sql=readFileSync(new URL('../supabase/migrations/008_services.sql',import.meta.url),'utf8');const list="('eye-exam','contacts','dry-eye','children','testing','skin-tightening','styling')";assert.equal(sql.split(list).length-1,2,'bookings and procedure_costs both allow it');for(const part of ['drop constraint if exists bookings_service_check','add column if not exists service_option text','drop constraint if exists procedure_costs_service_check',"values ('skin-tightening', 0, 0)"])assert.ok(sql.includes(part),part);for(const sv of services)assert.ok(sql.includes("'"+sv.id+"'"),sv.id);});

// The logo mark
test('the logo mark is a decorative gold outlined 3:2 rectangle, deeper gold on light backgrounds',()=>{
  const read=f=>readFileSync(new URL(f,import.meta.url),'utf8');
  const ui=read('../components/ui.js'),css=read('../app/site.css'),icon=read('../app/icon.svg');
  const start=ui.indexOf('export function Logo'),logo=ui.slice(start,ui.indexOf('</Link>;}',start));
  assert.ok(logo.includes('aria-label="Eyecon Optometry home"'));
  assert.ok(logo.includes('<svg className="logo-mark" viewBox="0 0 30 20" aria-hidden="true"'),'decorative inline SVG, 3:2');
  assert.ok(logo.includes('<rect x="1" y="1" width="28" height="18" fill="none" stroke="currentColor" strokeWidth="2"/>'),'outline, no fill');
  const rule=css.slice(css.indexOf('.logo-mark {'),css.indexOf('}',css.indexOf('.logo-mark {')));
  assert.ok(rule.includes('color: var(--gold-text)'),'deep gold on light backgrounds');
  assert.ok(!rule.includes('#'),'no new hex code');
  assert.ok(css.includes('.site-header.overlay:not(.scrolled) .logo-mark, .login-editorial .logo-mark { color: var(--gold); }'),'accent gold on dark backgrounds');
  assert.ok(icon.includes('<rect x="14" y="20" width="36" height="24" fill="none" stroke="#b49a67"'),'tab icon is the gold rectangle');
  assert.ok(ui.includes('aria-label={bookingLabel}'),'the short phone button keeps its full accessible name');
});

// Eyecon's real reviews
test('the real reviews are the ten supplied Google reviews, word for word, shown in both modes',async()=>{
  const { reviews, mentions, siteContent } = await import('../lib/config.js');
  assert.equal(reviews.length,10);
  assert.deepEqual(reviews.map(r=>r.name),['Charise S.','Nirvana','Thinh T.','Lilian E.','Matthew A.','Intermilan07','Liubov P.','Lynna J.','Kevin T.','Ram V.']);
  for(const r of reviews){assert.equal(r.source,'Google');assert.equal(r.stars,5);assert.ok(r.service);assert.ok(/^[A-Z][a-z]+ [A-Z]\.$/.test(r.name)||!r.name.includes(' '),'first name and last initial, or a username: '+r.name);}
  // Exactly as written, including the reviewers' own typos.
  assert.ok(reviews.find(r=>r.name==='Thinh T.').text.includes('repaired no one time, and no hassle I was helped'));
  assert.ok(reviews.find(r=>r.name==='Ram V.').text.includes('pleased with with the service'));
  assert.ok(reviews.find(r=>r.name==='Lynna J.').text.includes('finding the me some cool'));
  assert.ok(reviews.find(r=>r.name==='Nirvana').text.includes('professional — he fixed them'));
  assert.equal(reviews.find(r=>r.name==='Kevin T.').service,"Children's exam");
  for(const demo of [true,false]){const c=siteContent(demo);assert.equal(c.reviews.items,reviews);assert.equal(c.reviews.sample,false);assert.equal(c.mentions.sample,false);}
  assert.deepEqual(mentions,['Thorough eye exams','High-end selection','Friendly, knowledgeable staff','Great with kids','No wait time','Free adjustments']);
});
test('the featured quote opens on Kevin T., then Lilian E., then Ram V.',async()=>{
  const { reviews } = await import('../lib/config.js');
  const ordered=featuredFirst(reviews);
  assert.deepEqual(ordered.slice(0,3).map(r=>r.name),['Kevin T.','Lilian E.','Ram V.']);
  assert.equal(ordered.length,10);
  assert.deepEqual(ordered.slice(3).map(r=>r.name),['Charise S.','Nirvana','Thinh T.','Matthew A.','Intermilan07','Liubov P.','Lynna J.'],'the rest keep their order');
});
test('long featured reviews show a whole-word excerpt ending in an ellipsis; short ones are unchanged',async()=>{
  const { reviews } = await import('../lib/config.js');
  for(const r of reviews){
    const e=excerpt(r.text);
    if(r.text.length<=EXCERPT_LENGTH){assert.equal(e,r.text);continue;}
    assert.ok(e.endsWith('…'));assert.ok(e.length<=EXCERPT_LENGTH,r.name+' '+e.length);
    const body=e.slice(0,-1);assert.ok(r.text.startsWith(body),'a prefix of the full text');
    assert.ok(/[\s,;:.—-]/.test(r.text[body.length])||/[,;:.]/.test(r.text.slice(body.length,body.length+1)),'ends on a whole word: '+r.name);
  }
  assert.equal(excerpt('Short and sweet.'),'Short and sweet.');
  assert.ok(reviews.filter(r=>r.text.length>EXCERPT_LENGTH).length>=5,'several reviews need the toggle');
});
test('review cards clamp to four lines and open on click; the sample reviews tag is gone',()=>{
  const read=f=>readFileSync(new URL(f,import.meta.url),'utf8');
  const css=read('../app/site.css'),cards=read('../components/reviews.js'),landing=read('../components/landing.js');
  assert.ok(/\.review-card \.review-text \{[^}]*-webkit-line-clamp: 4/.test(css));
  assert.ok(css.includes('.review-card.open .review-text {'));
  assert.ok(cards.includes('aria-expanded={open}'));
  assert.ok(landing.includes("{open ? 'Show less' : 'Read full review'}"));
  assert.equal(landing.includes('Sample reviews'),false);assert.equal(cards.includes('Sample reviews'),false);
  assert.ok(cards.includes('Sample rating'),'a sample rating is still labelled');
});

test('clinic phoneHref is a digits-only tel: link and every call link uses it',()=>{
  assert.match(clinic.phoneHref,/^tel:\+\d+$/);
  assert.equal(clinic.phoneHref,'tel:+'+clinic.phone.replace(/\D/g,''));
  const read=f=>readFileSync(new URL(f,import.meta.url),'utf8');
  for(const f of ['../components/ui.js','../components/booking-flow.js','../components/booking-lookup.js','../components/landing.js']){
    assert.ok(!/'tel:'\s*\+\s*clinic\.phone/.test(read(f)),f+' builds tel: from the display phone');
  }
});

test('footer shows the clinic description under the logo',()=>{const ui=readFileSync(new URL('../components/ui.js',import.meta.url),'utf8');assert.ok(ui.includes('<div className="footer-brand"><Logo/><p className="footer-about">Eyecon is the leading provider of optometry services and vision care products in Edmonton. Come visit us today!</p></div>'));});

test('the homepage carousel shows Bottega Veneta fourth; /shop keeps collections order',()=>{
  const landing=readFileSync(new URL('../components/landing.js',import.meta.url),'utf8');
  assert.ok(landing.includes("return bottega ? [...rest.slice(0, 3), bottega, ...rest.slice(3)] : collections;"));
  for(const part of ['{carousel.map((b, i) => <div key={b.slug}','{carousel.map((b, i) => <li key={b.slug}>','{active + 1} of {carousel.length}'])assert.ok(landing.includes(part),part);
  const rest=collections.filter(b=>b.slug!=='bottega-veneta');
  assert.deepEqual([...rest.slice(0,3),collections.find(b=>b.slug==='bottega-veneta'),...rest.slice(3)].slice(0,4).map(b=>b.slug),['cartier','chrome-hearts','gucci','bottega-veneta']);
  assert.ok(!/carousel\.(map|length)/.test(readFileSync(new URL('../components/shop.js',import.meta.url),'utf8')),'/shop does not use the carousel order');
});

test('/shop opens with a photo header, the overlay site header, and the plain heading if the photo is missing',()=>{
  const read=f=>readFileSync(new URL(f,import.meta.url),'utf8');
  const shop=read('../components/shop.js'),css=read('../app/site.css').replace(/\r\n/g,'\n');
  for(const part of ["src: '/images/shop/hero-desktop.webp', width: 1664, height: 936","src: '/images/shop/hero-mobile.webp', width: 1080, height: 1350",
    '<source media="(max-width: 640px)" srcSet={narrow} />',"alt: 'Five models wearing luxury eyewear'","loading: 'eager', fetchPriority: 'high'",
    '<img ref={ref} {...rest} onError={onMissing} />','if (!photo) return <section className="shop-heading" aria-labelledby="shop-title">{words}</section>;',
    'overlay={photo} />','<ShopHeading photo={photo} onMissing={() => setPhoto(false)} />'])assert.ok(shop.includes(part),part);
  assert.ok(css.includes('height: 70vh; min-height: 480px; max-height: 820px;'),'about 70vh, 480 to 820px');
  assert.ok(css.includes('.shop-hero .container > * { max-width: min(24rem, 30%); }'),'words keep to the left third');
  assert.ok(css.includes('.shop-hero-photo { position: absolute; inset: 0 0 0 auto; z-index: -1; width: 68%; height: 100%; }'),'photo on the right two-thirds, clear of the words');
  assert.match(css,/@media \(max-width: 640px\) \{[^}]*\}[\s\S]*?\.shop-hero-photo \{ order: 1;[^}]*aspect-ratio: 4 \/ 5;/,'phones: words above the 4:5 photo');
});

test('the hero has one booking button: inside the gift tile on an affiliate page, with the prescription claim under it',()=>{
  const landing=readFileSync(new URL('../components/landing.js',import.meta.url),'utf8');
  assert.ok(!landing.includes('Pick your optometrist'),'no second hero button');
  assert.ok(/<Gift affiliate=\{affiliate\}>\s*<Button href=\{booking\} className="hero-book">Book Now<\/Button>\s*<Link className="gift-alt" href=\{booking \+ '&claim=prescription'\}>/.test(landing),'Book Now then the prescription link, inside the tile');
  assert.equal((landing.match(/className="hero-book"/g)||[]).length,2,'one hero button per kind of visitor');
  assert.ok(landing.includes("document.querySelector('.hero-book')"),'the floating mobile button follows the hero button');
  assert.ok(/<section className="doctors" id="doctors" aria-labelledby="doctors-title"[ >]/.test(landing));
  assert.equal((landing.match(/id="doctors"/g)||[]).length,1,'one #doctors target');
  assert.ok(!landing.includes('See appointment types'));
});

// Direct uploads (migration 009): the server checks what reached storage against what the patient declared.
test('checkUploadedFile accepts a matching stored file and refuses missing, resized, retyped or fake files',()=>{
  const pdf={name:'id.pdf',size:2048,type:'application/pdf'},head=Buffer.from('%PDF-1.7\n');
  assert.equal(checkUploadedFile(pdf,{size:2048,contentType:'application/pdf'},head),null);
  assert.equal(checkUploadedFile(pdf,{size:2048,contentType:'application/pdf; charset=binary'},head),null);
  assert.match(checkUploadedFile(pdf,null,null),/did not finish uploading/);
  assert.match(checkUploadedFile(pdf,{size:9999,contentType:'application/pdf'},head),/did not finish uploading/);
  assert.match(checkUploadedFile(pdf,{size:2048,contentType:'image/png'},head),/real PDF/);
  assert.match(checkUploadedFile(pdf,{size:2048,contentType:'application/pdf'},Buffer.from('MZ\x90\x00')),/real PDF/);
  const jpg={name:'diploma.jpg',size:10,type:'image/jpeg'};
  assert.equal(checkUploadedFile(jpg,{size:10,contentType:'image/jpeg'},Buffer.from([0xff,0xd8,0xff,0xe0])),null);
});
test('documents never pass through the website: the route takes JSON only and the browser uploads with signed links',()=>{
  const route=readFileSync(new URL('../app/api/documents/route.js',import.meta.url),'utf8');
  const provider=readFileSync(new URL('../components/provider.js',import.meta.url),'utf8');
  assert.ok(!route.includes('formData()'),'no multipart body is read');
  assert.ok(route.includes('createSignedUploadUrl'));
  assert.ok(route.includes('checkUploadedFile'),'stored files are checked before they are recorded');
  assert.ok(provider.includes('uploadToSignedUrl'));
  assert.ok(!/form\.append\('file'/.test(provider),'files are not posted to /api/documents');
  const migration=readFileSync(new URL('../supabase/migrations/009_direct_uploads.sql',import.meta.url),'utf8');
  assert.ok(migration.includes('revoke all on public.booking_document_uploads from anon, authenticated'));
});

// ---- Optometrist profiles and schedules (migration 010, lib/schedule.js) ----
import { clinicTime, clinicDate, validateWeeklyHours, validateTimeOff, validateExtraHours, validateDoctorProfile, doctorSlugFrom, planSlots, mergeGeneratedSlots, bookingsInTimeOff, offersService, websiteList, publicDoctor, inTimeOff } from '../lib/schedule.js';
import { placeholderDoctors, setDoctorDirectory } from '../lib/config.js';
const TZ = 'Etc/GMT+6';
test('the clinic keeps UTC−6 all year (Alberta Time), so winter times are not an hour off',()=>{
  assert.equal(clinic.timezone,process.env.NEXT_PUBLIC_CLINIC_TIMEZONE||'Etc/GMT+6');
  assert.equal(clinicTime('2026-07-06','09:00',TZ),'2026-07-06T15:00:00.000Z');
  assert.equal(clinicTime('2026-12-07','09:00',TZ),'2026-12-07T15:00:00.000Z');
  // A zone with daylight saving is still converted correctly on both sides of the change.
  assert.equal(clinicTime('2026-07-06','09:00','America/Denver'),'2026-07-06T15:00:00.000Z');
  assert.equal(clinicTime('2026-12-07','09:00','America/Denver'),'2026-12-07T16:00:00.000Z');
  assert.equal(clinicDate('2026-12-08T03:00:00.000Z',TZ),'2026-12-07');
  const env=readFileSync(new URL('../.env.example',import.meta.url),'utf8');assert.match(env,/NEXT_PUBLIC_CLINIC_TIMEZONE=Etc\/GMT\+6/);
});
test('weekly hours: days 1–7, end after start, rows on one day may not overlap; a gap is a break',()=>{
  assert.deepEqual(validateWeeklyHours([{weekday:1,start:'13:00',end:'17:00'},{weekday:1,start:'09:00',end:'12:00'}]).map(h=>h.start),['09:00','13:00']);
  assert.throws(()=>validateWeeklyHours([{weekday:2,start:'12:00',end:'09:00'}]),/end time must be after/);
  assert.throws(()=>validateWeeklyHours([{weekday:3,start:'09:00',end:'12:00'},{weekday:3,start:'11:30',end:'15:00'}]),/overlap/);
  assert.throws(()=>validateWeeklyHours([{weekday:8,start:'09:00',end:'10:00'}]),/day/);
  assert.throws(()=>validateWeeklyHours([{weekday:1,start:'9am',end:'10:00'}]),/HH:MM/);
  assert.deepEqual(validateWeeklyHours([]),[]);
});
test('time off: whole days run midnight to midnight in clinic time; part days use the times given',()=>{
  assert.deepEqual(validateTimeOff({from:'2026-12-07',reason:'Vacation'},TZ),{startsAt:'2026-12-07T06:00:00.000Z',endsAt:'2026-12-08T06:00:00.000Z',reason:'Vacation'});
  assert.equal(validateTimeOff({from:'2026-12-07',to:'2026-12-11'},TZ).endsAt,'2026-12-12T06:00:00.000Z');
  assert.deepEqual(validateTimeOff({from:'2026-12-07',fromTime:'13:00',toTime:'17:00'},TZ),{startsAt:'2026-12-07T19:00:00.000Z',endsAt:'2026-12-07T23:00:00.000Z',reason:''});
  assert.throws(()=>validateTimeOff({from:'2026-12-08',to:'2026-12-07'},TZ),/end after/);
  assert.throws(()=>validateTimeOff({from:''},TZ),/dates/);
  assert.throws(()=>validateExtraHours({day:'2026-12-12',start:'15:00',end:'10:00'}),/after the start/);
});
test('doctor profiles: names required, page name from the name, length from the list, all services stored as null',()=>{
  assert.equal(doctorSlugFrom('Zoë','Ngô-Smith'),'dr-zoe-ngo-smith');
  const d=validateDoctorProfile({first:'Jane',last:'Example',services:['eye-exam'],slotMinutes:45});
  assert.equal(d.slug,'dr-jane-example');assert.deepEqual(d.services,['eye-exam']);assert.equal(d.slotMinutes,45);assert.equal(d.visible,true);
  assert.equal(validateDoctorProfile({first:'A',last:'B',services:services.map(s=>s.id)}).services,null);
  assert.throws(()=>validateDoctorProfile({first:'',last:'B'}),/first and last/);
  assert.throws(()=>validateDoctorProfile({first:'A',last:'B',slotMinutes:20}),/appointment length/);
  assert.throws(()=>validateDoctorProfile({first:'A',last:'B',services:['surgery']}),/services/);
  assert.ok(offersService({services:null},'contacts'));assert.ok(!offersService({services:['eye-exam']},'contacts'));assert.ok(offersService({services:['eye-exam']},'eye-exam'));
  const pub=publicDoctor({...placeholderDoctors[0],slotMinutes:30,visible:false});assert.ok(!('slotMinutes' in pub));
  assert.deepEqual(websiteList([{slug:'b',order:2},{slug:'a',order:1},{slug:'c',order:0,visible:false}]).map(d=>d.slug),['a','b']);
});
test('planSlots: slots of the doctor’s length inside their hours and extra days, skipping breaks, time off and hidden doctors',()=>{
  const now=new Date('2026-12-06T12:00:00.000Z'); // a Sunday
  const doctors=[{slug:'a',slotMinutes:30,visible:true},{slug:'b',slotMinutes:60,visible:false}];
  const weeklyHours=[{doctor:'a',weekday:1,start:'09:00',end:'10:00'},{doctor:'a',weekday:1,start:'11:00',end:'12:00'},{doctor:'b',weekday:1,start:'09:00',end:'12:00'}];
  const plan=planSlots({doctors,weeklyHours,extraHours:[{doctor:'a',day:'2026-12-12',start:'10:00',end:'11:00'}],timeOff:[{doctor:'a',startsAt:'2026-12-14T06:00:00.000Z',endsAt:'2026-12-15T06:00:00.000Z'}],timeZone:TZ,now,days:8});
  assert.deepEqual(plan.map(s=>s.start),['2026-12-07T15:00:00.000Z','2026-12-07T15:30:00.000Z','2026-12-07T17:00:00.000Z','2026-12-07T17:30:00.000Z','2026-12-12T16:00:00.000Z','2026-12-12T16:30:00.000Z'],'Monday 7th with a break, the extra Saturday, and no slots on Monday 14th (time off)');
  assert.ok(plan.every(s=>s.doctor==='a'&&s.duration===30&&s.generated));
});
test('mergeGeneratedSlots keeps past, hand-added and booked slots, and replaces the rest with the plan',()=>{
  const now=new Date('2026-12-01T00:00:00.000Z');
  const slots=[{doctor:'a',start:'2026-11-30T15:00:00.000Z',duration:30,generated:true},{doctor:'a',start:'2026-12-02T15:00:00.000Z',duration:30,generated:true},{doctor:'a',start:'2026-12-02T16:00:00.000Z',duration:30,generated:true},{doctor:'a',start:'2026-12-03T15:00:00.000Z',duration:30},{doctor:'b',start:'2026-12-02T15:00:00.000Z',duration:30,generated:true}];
  const bookings=[{doctor:'a',start:'2026-12-02T16:00:00.000Z'}];
  const planned=[{doctor:'a',start:'2026-12-04T15:00:00.000Z',duration:30,generated:true}];
  const merged=mergeGeneratedSlots(slots,planned,bookings,{doctor:'a',now}).map(s=>s.doctor+s.start.slice(5,13));
  assert.deepEqual(merged,['a11-30T15','b12-02T15','a12-02T16','a12-03T15','a12-04T15']);
});
test('new time off lists the booked patients to rebook and never cancels them',()=>{
  const off={startsAt:'2026-12-07T06:00:00.000Z',endsAt:'2026-12-08T06:00:00.000Z'};
  const bookings=[{name:'In',doctor:'a',status:'Booked',start:'2026-12-07T15:00:00.000Z',duration:30},{name:'Other doctor',doctor:'b',status:'Booked',start:'2026-12-07T15:00:00.000Z'},{name:'Cancelled',doctor:'a',status:'Cancelled',start:'2026-12-07T15:00:00.000Z'},{name:'Next day',doctor:'a',status:'Booked',start:'2026-12-08T15:00:00.000Z'}];
  assert.deepEqual(bookingsInTimeOff(bookings,'a',off),[{name:'In',start:'2026-12-07T15:00:00.000Z'}]);
  assert.ok(inTimeOff({doctor:'a',start:'2026-12-07T15:00:00.000Z',duration:30},[{doctor:'a',...off}]));
  assert.ok(!inTimeOff({doctor:'b',start:'2026-12-07T15:00:00.000Z',duration:30},[{doctor:'a',...off}]));
});
test('demo staff manage optometrists and schedules; patients can only book shown optometrists for their services',()=>{
  const staff={role:'staff'};let data=seedDemo();
  assert.equal(data.doctors.length,2);assert.ok(data.weeklyHours.length&&data.slots.every(s=>s.generated));
  data=applyDemo(data,'doctor',{isNew:true,first:'Jane',last:'Example',services:['eye-exam']},staff);
  assert.throws(()=>applyDemo(data,'doctor',{isNew:true,first:'Jane',last:'Example'},staff),/already exists/);
  assert.ok(!data.slots.some(s=>s.doctor==='dr-jane-example'),'no hours yet, no times');
  data=applyDemo(data,'doctor-hours',{doctor:'dr-jane-example',slotMinutes:60,hours:[{weekday:2,start:'09:00',end:'12:00'}]},staff);
  const jane=data.slots.filter(s=>s.doctor==='dr-jane-example');assert.ok(jane.length>=36&&jane.every(s=>s.duration===60));
  setDoctorDirectory(data.doctors);
  try{
    const slot=jane[0],booking={name:'Sample patient',email:'p@example.com',phone:'+14165550100',doctor:'dr-jane-example',start:slot.start,service:'contacts',firstVisit:true};
    assert.throws(()=>applyDemo(data,'booking',booking,null),/another optometrist/,'Jane does not fit contact lenses');
    const booked=applyDemo(data,'booking',{...booking,service:'eye-exam'},null);
    // Time off on a booked day keeps the booking and its slot; the other times that day go.
    const day=clinicDate(slot.start,clinic.timezone);
    const off=applyDemo(booked,'time-off-add',{doctor:'dr-jane-example',from:day},staff);
    assert.ok(off.slots.some(s=>s.doctor==='dr-jane-example'&&s.start===slot.start));
    assert.equal(off.slots.filter(s=>s.doctor==='dr-jane-example'&&clinicDate(s.start,clinic.timezone)===day).length,1);
    assert.equal(off.bookings.filter(b=>b.doctor==='dr-jane-example').length,1);
    // Hiding removes her open times and online booking, but keeps her name for the booking.
    const hidden=applyDemo(off,'doctor',{...off.doctors.find(d=>d.slug==='dr-jane-example'),visible:false},staff);setDoctorDirectory(hidden.doctors);
    assert.deepEqual(hidden.slots.filter(s=>s.doctor==='dr-jane-example').map(s=>s.start),[slot.start]);
    assert.equal(doctorName('dr-jane-example'),'Dr. Jane Example');
    assert.throws(()=>applyDemo(hidden,'doctor-hours',{doctor:'dr-jane-example',slotMinutes:20,hours:[]},staff),/appointment length/);
    assert.throws(()=>applyDemo(hidden,'doctor',{isNew:true,first:'X',last:'Y'},{role:'affiliate'}),/Staff/);
  }finally{setDoctorDirectory(placeholderDoctors);}
});
test('migration 010 is server-only, keeps booked and hand-added slots, and hides time off and hidden doctors from open times',()=>{
  const sql=readFileSync(new URL('../supabase/migrations/010_doctors_and_schedules.sql',import.meta.url),'utf8');
  assert.match(sql,/after 009_direct_uploads\.sql/);
  assert.match(sql,/revoke all on public\.doctors, public\.doctor_weekly_hours, public\.doctor_time_off, public\.doctor_extra_hours from anon, authenticated/);
  for(const f of ['planned_doctor_slots','generate_doctor_slots','save_doctor_hours'])assert.match(sql,new RegExp(`grant execute on function public\\.${f}\\([^)]*\\) to service_role`));
  assert.match(sql,/s\.generated and s\.start > now\(\)/,'only future generated slots are removed');
  assert.match(sql,/not exists \(select 1 from bookings b where b\.doctor = s\.doctor and b\.start = s\.start\)/,'booked slots are never removed');
  assert.match(sql,/join doctors d on d\.slug = s\.doctor and d\.visible/);
  assert.match(sql,/from doctor_time_off t where t\.doctor = s\.doctor/);
  const route=readFileSync(new URL('../app/api/doctors/route.js',import.meta.url),'utf8');
  assert.match(route,/requireStaff\(u\)/);assert.match(route,/publicDoctor/);assert.ok(!/delete\(\)\.eq\('slug'/.test(route),'optometrists are never deleted');
});

test('affiliate invitation errors are explained in plain words (email limit, existing account, other)',()=>{
  assert.match(inviteErrorMessage({code:'over_email_send_rate_limit',status:429,message:'email rate limit exceeded'}),/email limit/);
  assert.match(inviteErrorMessage({status:429}),/wait about an hour/);
  assert.match(inviteErrorMessage({code:'email_exists',status:422}),/already has an account/);
  assert.match(inviteErrorMessage({message:'A user with this email address has already been registered'}),/already has an account/);
  assert.match(inviteErrorMessage({status:500,message:'boom'}),/could not be sent/);
  const route=readFileSync(new URL('../app/api/workspace/route.js',import.meta.url),'utf8');assert.match(route,/inviteErrorMessage\(inviteError\)/);
});
test('staff see the clinic time zone as Alberta Time, not its technical name',()=>{
  if(!process.env.NEXT_PUBLIC_CLINIC_TIMEZONE)assert.equal(clinic.timezoneLabel,'Alberta Time (UTC−6)');
  const ws=readFileSync(new URL('../components/workspace.js',import.meta.url),'utf8');assert.ok(ws.includes('Times in {clinic.timezoneLabel}'));
});

test('password reset and invitation links always open the set-password form, wherever they land',async()=>{
  const { passwordLinkType, onPasswordForm, passwordFormPath } = await import('../lib/supabase.js');
  assert.equal(passwordLinkType({hash:'#access_token=x&type=recovery'}),'recovery');
  assert.equal(passwordLinkType({hash:'#access_token=x&type=invite'}),'invite');
  assert.equal(passwordLinkType({hash:'#access_token=x&type=magiclink'}),null);
  assert.equal(passwordLinkType({hash:''}),null);
  assert.equal(passwordFormPath('recovery'),'/login?mode=reset');assert.equal(passwordFormPath('invite'),'/login?set-password=1');
  assert.ok(onPasswordForm({pathname:'/login',search:'?mode=reset'}));assert.ok(onPasswordForm({pathname:'/login',search:'?set-password=1'}));
  assert.ok(!onPasswordForm({pathname:'/',search:''}));assert.ok(!onPasswordForm({pathname:'/login',search:''}));
  const provider=readFileSync(new URL('../components/provider.js',import.meta.url),'utf8');
  assert.match(provider,/PASSWORD_RECOVERY/);assert.match(provider,/passwordLinkType\(window\.location\)/);
});
test('the sign-in form has a show/hide password button and a Caps Lock warning',()=>{
  const form=readFileSync(new URL('../components/login-form.js',import.meta.url),'utf8');
  assert.match(form,/type=\{show\?'text':'password'\}/);assert.match(form,/aria-label=\{show\?'Hide password':'Show password'\}/);
  assert.match(form,/getModifierState\?\.\('CapsLock'\)/);assert.match(form,/Caps Lock is on/);
  assert.ok(!/id="password" type="password"/.test(form),'the old plain password box is gone');
});

// Gift cards released when a visitor opens an affiliate's link (Stage 3)
import { releaseGiftCard,giftCountdown,giftDaysLeft,giftExpired,checkGiftClaim } from '../lib/gift.js';
import { demoReleaseGift } from '../lib/demo.js';
const GIFT_TZ='Pacific/Honolulu'; // UTC-10 all year, so these edge days do not depend on the clock-change rules in the machine's time zone data
const released=(data=seedDemo(),slug='alex-morgan',now=new Date())=>demoReleaseGift(data,slug,now);
const bookWith=(data,token,affiliateId='demo-alex',slot=data.slots[2])=>applyDemo(data,'booking',{...at(slot),affiliateId,giftToken:token},null);
test('a released card starts its days at release, with a six-character serial and no booking',()=>{
  const now=new Date('2026-10-09T15:00:00.000Z'),c=releaseGiftCard(()=>false,now);
  assert.match(c.serial,/^[2-9A-HJ-NP-Z]{6}$/);assert.equal(c.status,'Released');assert.equal(c.releasedAt,now.toISOString());
  assert.equal(c.expiresAt,new Date(now.getTime()+30*86400000).toISOString());
  const {data,card}=released(seedDemo(),'alex-morgan',now);
  assert.deepEqual(Object.keys(card).sort(),['expiresAt','releasedAt','serial','token']);assert.ok(card.token.length>=64);
  assert.equal(data.giftCards.length,1);assert.equal(data.giftCards[0].status,'Released');assert.equal(data.giftCards[0].bookingId,null);
});
test('a card is released only for a known, active affiliate, and never repeats a serial in use',()=>{
  assert.throws(()=>released(seedDemo(),'nobody'),/unavailable/);
  const off=seedDemo();off.affiliates[0].active=false;assert.throws(()=>released(off),/unavailable/);
  const data=seedDemo(),used=data.bookings.find(b=>b.giftCard).giftCard.serial;
  for(let i=0;i<200;i++)assert.notEqual(released(data).card.serial,used);
});
test('booking with the token claims the card: same serial, release and expiry dates, status Claimed',()=>{
  const {data,card}=released(seedDemo(),'alex-morgan',new Date(Date.now()-5*86400000));
  const next=bookWith(data,card.token),b=next.bookings[0];
  assert.equal(b.giftCard.serial,card.serial);assert.equal(b.giftCard.issuedAt,card.releasedAt);assert.equal(b.giftCard.expiresAt,card.expiresAt);assert.equal(b.giftCard.status,'Claimed');
  assert.equal(next.giftCards[0].status,'Claimed');assert.equal(next.giftCards[0].bookingId,b.id);
  assert.ok(!('giftToken' in b),'the token is not stored on the booking');
});
test('an expired card books normally without a gift card',()=>{
  const {data,card}=released(seedDemo(),'alex-morgan',new Date(Date.now()-181*86400000));
  const next=bookWith(data,card.token);assert.equal(next.bookings.length,data.bookings.length+1);
  assert.ok(!('giftCard' in next.bookings[0]));assert.equal(next.giftCards[0].status,'Released');
});
test('a card cannot be claimed for another affiliate or for a direct booking',()=>{
  const seeded=seedDemo();seeded.affiliates.push({...seeded.affiliates[0],id:'demo-sam',slug:'sam-lee',name:'Sam Lee'});
  const {data,card}=released(seeded,'alex-morgan');
  assert.ok(!('giftCard' in bookWith(data,card.token,'demo-sam').bookings[0]));
  assert.ok(!('giftCard' in applyDemo(data,'booking',{...at(data.slots[2]),giftToken:card.token},null).bookings[0]));
  assert.ok(!('giftCard' in bookWith(data,'not-a-real-token').bookings[0]));
  assert.equal(bookWith(data,card.token,'demo-sam').giftCards[0].status,'Released');
});
test('a card can be claimed only once',()=>{
  const {data,card}=released();const first=bookWith(data,card.token);
  assert.equal(first.bookings[0].giftCard.status,'Claimed');
  const second=bookWith(first,card.token,'demo-alex',first.slots[3]);
  assert.ok(!('giftCard' in second.bookings[0]));assert.equal(second.giftCards[0].bookingId,first.bookings[0].id);
});
test('without a token (browser storage unavailable) the card is issued at booking, as before',()=>{
  const data=seedDemo(),b=applyDemo(data,'booking',{...at(data.slots[2]),affiliateId:'demo-alex'},null).bookings[0];
  assert.equal(b.giftCard.status,'Issued');assert.match(b.giftCard.serial,/^[2-9A-HJ-NP-Z]{6}$/);
});
test('the claim rule names why a card is refused',()=>{
  const ok={affiliateId:'a',expiresAt:new Date(Date.now()+86400000).toISOString(),status:'Released',bookingId:null};
  assert.equal(checkGiftClaim(ok,'a').ok,true);
  assert.equal(checkGiftClaim(null,'a').reason,'unknown');assert.equal(checkGiftClaim(ok,'b').reason,'wrong-affiliate');assert.equal(checkGiftClaim(ok,null).reason,'wrong-affiliate');
  assert.equal(checkGiftClaim({...ok,status:'Claimed',bookingId:'x'},'a').reason,'claimed');assert.equal(checkGiftClaim({...ok,status:'Void'},'a').reason,'void');
  assert.equal(checkGiftClaim({...ok,expiresAt:new Date(Date.now()-2*86400000).toISOString()},'a').reason,'expired');
});
test('the countdown counts calendar days in clinic time, with Last day and Expired at the edges',()=>{
  const expires='2026-12-31T23:00:00Z'; // 1 pm on 31 December in Honolulu
  const label=iso=>giftCountdown(expires,new Date(iso),GIFT_TZ).label;
  assert.equal(label('2026-12-29T18:00:00Z'),'2 days left');
  assert.equal(label('2026-12-30T18:00:00Z'),'1 day left');
  assert.equal(label('2026-12-31T10:00:00Z'),'Last day'); // 00:00 on the day, clinic time
  assert.equal(label('2027-01-01T05:00:00Z'),'Last day'); // 7 pm, after the 1 pm expiry time: the day is not over
  assert.equal(label('2027-01-01T09:59:00Z'),'Last day'); // 23:59 on the day
  assert.equal(label('2027-01-01T10:00:00Z'),'Expired'); // midnight ends it
  assert.equal(label('2026-12-31T05:00:00Z'),'1 day left'); // 7 pm on 30 Dec in Honolulu, already 31 Dec in UTC
  const state=iso=>giftCountdown(expires,new Date(iso),GIFT_TZ).state;
  assert.deepEqual([state('2026-12-31T15:00:00Z'),state('2027-01-05T12:00:00Z'),state('2026-06-01T12:00:00Z')],['last','expired','days']);
  assert.equal(giftDaysLeft(expires,new Date('2027-01-03T12:00:00Z'),GIFT_TZ),-3);
  assert.equal(giftExpired(expires,new Date('2027-01-01T05:00:00Z'),GIFT_TZ),false);assert.equal(giftExpired(expires,new Date('2027-01-01T10:00:00Z'),GIFT_TZ),true);
  const now=new Date('2026-10-09T15:00:00Z');assert.equal(giftCountdown(releaseGiftCard(()=>false,now).expiresAt,now,GIFT_TZ).label,'30 days left');
});
test('the release API, claim and migration follow the rules',()=>{
  const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
  const route=read('../app/api/gift/route.js');assert.ok(route.includes('sameOrigin(request)')&&route.includes('requestHash(request)')&&route.includes('releaseGift'));
  const server=read('../lib/server.js');assert.ok(server.includes('hashToken(token)')&&server.includes("rpc('release_gift_card'")&&server.includes('checkGiftClaim')&&server.includes(".eq('status','Released')"));
  assert.ok(read('../app/api/bookings/route.js').includes('claimGift(db,row,raw.giftToken)'));
  const sql=read('../supabase/migrations/011_released_gift_cards.sql');
  assert.ok(sql.startsWith('--')&&sql.includes('after 010')&&sql.includes('create table public.gift_cards')&&sql.includes("'^[2-9A-HJ-NP-Z]{6}$'")&&sql.includes('token_hash text not null')&&sql.includes('enable row level security')&&sql.includes('revoke all on public.gift_cards'));
  assert.ok(sql.includes("('Released','Claimed','Redeemed','Expired','Void')")&&sql.includes('gift_cards_serial_unique')&&sql.includes('bookings_gift_serial_guard'));
  assert.ok(read('../components/use-gift.js').includes('resolveGift')&&read('../lib/gift-browser.js').includes('giftStorageWorks')&&read('../lib/gift-browser.js').includes('try {'));
  const ui=read('../components/ui.js');assert.ok(ui.includes('setNow(new Date())')&&ui.includes('gift-number'));
  assert.ok(read('../app/gift-card-terms/page.js').includes('from the day the card is issued')&&!read('../lib/notifications.js').includes('from the day you received it'));
});

// If releasing a card fails for any reason, the visitor still gets a card, issued at booking
import { resolveGift,GIFT_FALLBACK } from '../lib/gift-browser.js';
const goodCard=()=>({serial:'7K2M9Q',releasedAt:'2026-10-09T15:00:00.000Z',expiresAt:'2027-04-07T15:00:00.000Z',token:'t'.repeat(64)});
const opts=over=>({release:async()=>goodCard(),read:()=>null,write:()=>true,storageWorks:()=>true,...over});
test('a visitor with a stored card gets the same card and no new request is made',async()=>{
  let calls=0;const stored=goodCard();
  const r=await resolveGift('alex-morgan',opts({read:()=>stored,release:async()=>{calls++;return goodCard();}}));
  assert.equal(r.status,'ready');assert.equal(r.card,stored);assert.equal(calls,0);
});
test('a card is requested, saved and returned the first time',async()=>{
  let saved=null;const r=await resolveGift('alex-morgan',opts({write:(slug,card)=>{saved={slug,card};return true;}}));
  assert.equal(r.status,'ready');assert.equal(r.card.serial,'7K2M9Q');assert.equal(saved.slug,'alex-morgan');
});
test('unavailable storage falls back without asking the server for a card',async()=>{
  let calls=0;const r=await resolveGift('alex-morgan',opts({storageWorks:()=>false,release:async()=>{calls++;return goodCard();}}));
  assert.equal(r,GIFT_FALLBACK);assert.equal(calls,0);
});
test('a rate limit, network error, server error or unusable reply falls back to a card issued at booking',async()=>{
  const failures=[async()=>{throw new Error('Too many requests. Please try again later.');},async()=>{throw new TypeError('Failed to fetch');},async()=>{throw new Error('Your gift card could not be prepared. You can still book.');},async()=>({}),async()=>null,async()=>({...goodCard(),serial:'••••••'})];
  for(const release of failures){const r=await resolveGift('alex-morgan',opts({release}));assert.deepEqual(r,{status:'fallback',card:null});}
  assert.equal((await resolveGift('alex-morgan',opts({write:()=>false}))).status,'fallback','a card that cannot be saved is not used');
  // The fallback sends no token, so the server issues the card at booking, as it did before cards were released.
  const data=seedDemo(),giftToken=GIFT_FALLBACK.card?.token;
  const b=applyDemo(data,'booking',{...at(data.slots[2]),affiliateId:'demo-alex',giftToken},null).bookings[0];
  assert.equal(b.giftCard.status,'Issued');assert.match(b.giftCard.serial,/^[2-9A-HJ-NP-Z]{6}$/);
  const route=readFileSync(new URL('../app/api/bookings/route.js',import.meta.url),'utf8');
  assert.ok(route.includes('raw.giftToken?await claimGift(db,row,raw.giftToken):await issueGift(db,row)'));
});

// Link previews for /book/[slug]
import { previewAffiliate,previewTitle,previewDescription,previewMetadata,PREVIEW_FALLBACK_PHOTO,PREVIEW_SIZE } from '../lib/preview.js';
const alex=()=>seedDemo().affiliates.find(a=>a.slug==='alex-morgan');
test('a link preview names the active affiliate and carries only public fields',()=>{
  const a=previewAffiliate({...alex(),email:'alex@example.com',commissionRate:10,commissionNote:'private'});
  assert.deepEqual(Object.keys(a).sort(),['name','photo','slug']);
  assert.equal(a.name,'Alex Morgan');assert.equal(previewTitle(a),'Alex Morgan invites you to Eyecon Optometry');
  assert.ok(previewDescription(a).includes('$50 gift card on your first visit'));
});
test('an unknown slug gets the plain Eyecon preview',()=>{
  const none=previewAffiliate(seedDemo().affiliates.find(x=>x.slug==='no-such-person'));
  assert.equal(none,null);assert.equal(previewTitle(none),'Eyecon Optometry');assert.ok(!previewDescription(none).includes('invites'));
});
test('an inactive affiliate gets the plain Eyecon preview',()=>{
  assert.equal(previewAffiliate({...alex(),active:false}),null);
});
test('a missing or unsafe photo falls back to the shared placeholder',()=>{
  for(const photo of [undefined,null,'','http://example.com/a.jpg','javascript:alert(1)'])assert.equal(previewAffiliate({...alex(),photo}).photo,PREVIEW_FALLBACK_PHOTO);
  assert.equal(previewAffiliate({...alex(),photo:'https://example.supabase.co/a.jpg'}).photo,'https://example.supabase.co/a.jpg');
});
test('preview metadata is noindex, uses the site URL as base and sets a large social card',()=>{
  const m=previewMetadata(previewAffiliate(alex()),'https://eyecon-ecosystem.vercel.app');
  assert.equal(m.metadataBase.href,'https://eyecon-ecosystem.vercel.app/');
  assert.deepEqual(m.robots,{index:false,follow:false});
  assert.equal(m.title.absolute,'Alex Morgan invites you to Eyecon Optometry');
  assert.equal(m.openGraph.title,m.title.absolute);assert.equal(m.twitter.card,'summary_large_image');
  assert.equal(previewMetadata(null,'https://example.com').title.absolute,'Eyecon Optometry');
  assert.ok(!('metadataBase' in previewMetadata(null,'not a url')));
  assert.deepEqual(PREVIEW_SIZE,{width:1200,height:630});
});
test('the referral page builds its metadata on the server from the affiliate',()=>{
  const page=readFileSync(new URL('../app/book/[slug]/page.js',import.meta.url),'utf8');
  assert.ok(page.includes('export async function generateMetadata')&&page.includes('loadPreviewAffiliate'));
  assert.ok(!page.includes('export const metadata'));
  const data=readFileSync(new URL('../lib/preview-data.js',import.meta.url),'utf8');
  assert.ok(data.includes('publicAffiliate')&&data.includes(".eq('active', true)")&&data.includes('seedDemo'));
  const image=readFileSync(new URL('../app/book/[slug]/opengraph-image.js',import.meta.url),'utf8');
  assert.ok(image.includes('PREVIEW_GIFT_LINE')&&image.includes('previewPhotoUri')&&image.includes('size=PREVIEW_SIZE'.replace('=',' = ')));
});

// The live gift card code in lib/server.js actually runs (a missing import once made every release fail on the live
// site while the tests above, which only read the source, still passed). It is loaded the way Next loads server code
// (the react-server condition), in a child process, against a fake database.
import { execFileSync } from 'node:child_process';
test('the server releases and claims gift cards without errors',()=>{
  const script=`
    const { releaseGift, claimGift } = await import(${JSON.stringify(new URL('../lib/server.js',import.meta.url).href)});
    const calls = [];
    const db = {
      rpc: async (name, args) => { calls.push([name, args.p_days, /^[2-9A-HJ-NP-Z]{6}$/.test(args.p_serial)]); return { data: [{ serial: args.p_serial, released_at: '2026-10-23T14:00:00Z', expires_at: '2027-04-21T14:00:00Z' }], error: null }; },
      from: table => { const q = { select: () => q, eq: () => q, is: () => q,
        maybeSingle: async () => ({ data: { id: 'c1', affiliate_id: 'a1', serial: '7K2M9Q', released_at: '2026-10-23T14:00:00Z', expires_at: '2999-01-01T00:00:00Z', status: 'Released', booking_id: null } }),
        update: fields => { calls.push(['update', table, fields.status || fields.gift_status]); return { eq: () => ({ eq: () => ({ is: () => ({ select: async () => ({ data: [{ id: 'c1' }], error: null }) }) }), is: async () => ({ error: null }) }) }; } };
        return q; }
    };
    const card = await releaseGift(db, 'a1', 'hash');
    const booked = await claimGift(db, { id: 'b1', affiliate_id: 'a1' }, card.token);
    console.log(JSON.stringify({ serialOk: /^[2-9A-HJ-NP-Z]{6}$/.test(card.serial), tokenLength: card.token.length, expiresAt: card.expiresAt, claimed: booked.gift_status, claimedSerial: booked.gift_serial, calls }));`;
  const out=JSON.parse(execFileSync(process.execPath,['--conditions=react-server','--input-type=module','-e',script],{encoding:'utf8'}).trim().split('\n').pop());
  assert.equal(out.serialOk,true);assert.equal(out.tokenLength,64);assert.equal(out.expiresAt,'2027-04-21T14:00:00Z');
  assert.deepEqual(out.calls[0],['release_gift_card',30,true],'releases call the database with a valid serial and 30 days');
  assert.equal(out.claimed,'Claimed');assert.equal(out.claimedSerial,'7K2M9Q');
});
test('the issued gift card shows title, one small line, then the QR code with the card number under it, and never dots',()=>{
  const ui=readFileSync(new URL('../components/ui.js',import.meta.url),'utf8');
  assert.ok(ui.includes('Your gift card for your first visit')&&ui.includes('Card number issued when you book'));
  assert.ok(!ui.includes('HIDDEN_SERIAL')&&!ui.includes('days from booking'),'no hidden-serial dots or booking-based wording in the pill');
  const title=ui.indexOf('your first visit</strong>'),valid=ui.indexOf('Valid until {until}'),qr=ui.indexOf('<QR url={origin+giftCardPath(number)}'),num=ui.indexOf('className="gift-number"');
  assert.ok(title<valid&&valid<qr&&qr<num,'title, validity, QR code, then the number under it');
  assert.ok(ui.includes('const code=card&&!ended'),'no QR before a card exists or once it has expired');
  const css=readFileSync(new URL('../app/site.css',import.meta.url),'utf8');
  assert.ok(/\.gift \{ display: flex; align-items: center;/.test(css)&&!/\.gift-number \{[^}]*justify-self/.test(css));
});

// The gift card is issued only once the visitor books (or claims it with a prescription): nothing is released when the
// affiliate page or the booking page opens, so neither shows a card number before then.
test('no gift card is released or shown before booking',()=>{
  for(const f of ['../components/landing.js','../components/booking-flow.js']){
    const src=readFileSync(new URL(f,import.meta.url),'utf8');
    assert.ok(!src.includes('useGift')&&!src.includes('giftToken'),f+' does not release a card or send a claim token');
  }
  const flow=readFileSync(new URL('../components/booking-flow.js',import.meta.url),'utf8');
  assert.ok(flow.includes('<Gift compact affiliate={affiliate} />'),'the booking steps show the offer with no card');
  const data=seedDemo(),slot=data.slots[2];
  const b=applyDemo(data,'booking',validateBooking({...at(slot),affiliateId:'demo-alex'}),null).bookings[0];
  assert.equal(b.giftCard.status,'Issued');assert.match(b.giftCard.serial,/^[2-9A-HJ-NP-Z]{6}$/);
  assert.equal(Math.round((new Date(b.giftCard.expiresAt)-new Date(b.giftCard.issuedAt))/86400000),30,'the 30 days start at booking');
});

// "Already have a prescription": a gift card claimed without booking, through an affiliate's link only.
import { validateClaim } from '../lib/validation.js';
const claimer={name:'Sample claimant',email:'Claim@Example.com',affiliateId:'demo-alex'};
test('a prescription claim needs a name, an email and an affiliate; the health card is optional',()=>{
  const c=validateClaim(claimer);assert.equal(c.email,'claim@example.com');assert.equal(c.healthCard,'');
  assert.throws(()=>validateClaim({...claimer,name:'A'}),/full name/);
  assert.throws(()=>validateClaim({...claimer,email:'nope'}),/valid email/);
  assert.throws(()=>validateClaim({...claimer,affiliateId:''}),/referral link/);
  assert.throws(()=>validateClaim({...claimer,healthCard:'12<script>'}),/health card/);
  assert.equal(validateClaim({...claimer,healthCard:'12345-6789'}).healthCard,'12345-6789');
});
test('the demo issues one prescription gift card per email per affiliate, with no booking',()=>{
  const data=seedDemo(),next=applyDemo(data,'claim',{...claimer,healthCard:'123456789',policy:'P-1'},null);
  const g=next.giftClaims[0];
  assert.equal(g.status,'Issued');assert.match(g.serial,/^[2-9A-HJ-NP-Z]{6}$/);assert.equal(g.affiliateId,'demo-alex');
  assert.equal(Math.round((new Date(g.expiresAt)-new Date(g.issuedAt))/86400000),30);
  assert.equal(next.bookings.length,data.bookings.length,'no booking is created');
  assert.ok(!JSON.stringify(g).includes('123456789')&&!JSON.stringify(g).includes('P-1'),'the demo keeps no health card or policy number');
  assert.throws(()=>applyDemo(next,'claim',{...claimer,email:'claim@example.com'},null),/already been sent/);
  assert.throws(()=>applyDemo(data,'claim',{...claimer,affiliateId:'nobody'},null),/no longer available/);
  assert.ok(!affiliateRows(next.bookings,'demo-alex').some(r=>r.email==='claim@example.com'),'claims never reach the affiliate view');
});
test('prescription claims: migration 012, route and booking page',()=>{
  const sql=readFileSync(new URL('../supabase/migrations/012_prescription_gift_claims.sql',import.meta.url),'utf8');
  assert.ok(sql.startsWith('--')&&sql.includes('after 011_released_gift_cards.sql')&&sql.includes('create table public.gift_claims'));
  assert.ok(sql.includes('gift_claims_email_unique on public.gift_claims(affiliate_id, lower(email))')&&sql.includes("raise exception 'already claimed'"));
  assert.ok(sql.includes('revoke all on public.gift_claims from anon, authenticated')&&sql.includes('to service_role')&&sql.includes('gift_claim_serial_guard'));
  const route=readFileSync(new URL('../app/api/gift/claim/route.js',import.meta.url),'utf8');
  assert.ok(route.includes('sameOrigin(request)')&&route.includes("verifyTurnstile(request,raw.captcha,'claim')")&&route.includes('requestHash(request)')&&route.includes('validateClaim(raw)'));
  assert.ok(!/health|policy/i.test(route.split('Response.json(')[1]),'the reply carries no health card or policy number');
  const flow=readFileSync(new URL('../components/booking-flow.js',import.meta.url),'utf8');
  assert.ok(flow.includes("{affiliate && <label className={`service-choice prescription-choice")&&flow.includes('Already have a prescription</strong>'),'the choice is offered only with an affiliate');
  assert.ok(flow.includes("params.get('claim') === 'prescription'")&&flow.includes('<Captcha key={captchaKey} action="claim"'));
});
test('the server issues a prescription gift card and writes its email without errors',()=>{
  const script=`
    const { claimPrescriptionGift } = await import(${JSON.stringify(new URL('../lib/server.js',import.meta.url).href)});
    const { claimEmailText } = await import(${JSON.stringify(new URL('../lib/notifications.js',import.meta.url).href)});
    const calls = [];
    const ok = { rpc: async (name, a) => { calls.push([name, a.p_days, /^[2-9A-HJ-NP-Z]{6}$/.test(a.p_serial), a.p_health_card, a.p_policy]); return { data: [{ id: 'g1', name: a.p_name, email: a.p_email, serial: a.p_serial, issued_at: '2026-10-26T07:00:00Z', expires_at: '2027-04-24T07:00:00Z' }], error: null }; } };
    const card = await claimPrescriptionGift(ok, { name: 'Sample claimant', email: 'claim@example.com', healthCard: '', insurance: '', policy: '', affiliateId: 'a1' }, 'hash');
    let taken = ''; try { await claimPrescriptionGift({ rpc: async () => ({ data: null, error: { message: 'already claimed' } }) }, { name: 'Sample claimant', email: 'claim@example.com', healthCard: '', policy: '', affiliateId: 'a1' }, 'hash'); } catch (e) { taken = e.status + ' ' + e.message; }
    const text = claimEmailText(card, { name: 'Alex Morgan', code: null });
    console.log(JSON.stringify({ card, calls, taken, text }));`;
  const out=JSON.parse(execFileSync(process.execPath,['--conditions=react-server','--input-type=module','-e',script],{encoding:'utf8'}).trim().split('\n').pop());
  assert.deepEqual(out.calls[0],['claim_prescription_gift',30,true,null,null],'30 days, a valid serial, blank numbers stored as null');
  assert.equal(out.card.id,'g1');assert.match(out.card.serial,/^[2-9A-HJ-NP-Z]{6}$/);
  assert.match(out.taken,/^409 A gift card has already been sent/);
  assert.ok(out.text.includes('EYC-AMO-'+out.card.serial)&&out.text.includes('Hi Sample,')&&out.text.includes('with your prescription'));
});

// The QR gift card and the staff scan (/gift/[number], /api/gift/scan).
import { parseGiftNumber,giftCardPath,giftScanView,SCAN_KEYS,SCAN_BOOKING_KEYS } from '../lib/gift.js';
import { demoScanGift } from '../lib/demo.js';
test('card numbers are read from the full number, any case or spacing, or the bare serial',()=>{
  assert.equal(parseGiftNumber('EYC-AMO-7K2M9Q'),'7K2M9Q');assert.equal(parseGiftNumber(' eyc-amo-7k2m9q '),'7K2M9Q');assert.equal(parseGiftNumber('7k2m9q'),'7K2M9Q');
  for(const bad of ['', 'EYC-AMO-7K2M9', 'EYC-AMO-0K2M9Q', 'EYC-AM-7K2M9Q', 'XYZ-AMO-7K2M9Q', '<script>'])assert.equal(parseGiftNumber(bad),null,bad);
  assert.equal(giftCardPath('EYC-AMO-7K2M9Q'),'/gift/EYC-AMO-7K2M9Q');
});
test('staff scans show name, email and the booking, or name, email and number for a prescription card, and nothing else',()=>{
  const booked=applyDemo(seedDemo(),'booking',validateBooking({...at(seedDemo().slots[2]),affiliateId:'demo-alex'}),null);
  const data=applyDemo(booked,'claim',{name:'Sample claimant',email:'claim@example.com',affiliateId:'demo-alex',healthCard:'123456789',policy:'P-1'},null);
  const b=data.bookings[0],c=data.giftClaims[0],staff={role:'staff'};
  const one=demoScanGift(data,'EYC-AMO-'+b.giftCard.serial,staff);
  assert.equal(one.kind,'booking');assert.equal(one.name,b.name);assert.equal(one.email,b.email);assert.equal(one.number,'EYC-AMO-'+b.giftCard.serial);assert.equal(one.expired,false);
  assert.equal(one.booking.reference,b.reference);assert.equal(one.booking.doctor,b.doctor);assert.equal(one.booking.start,b.start);
  assert.deepEqual(Object.keys(one).sort(),SCAN_KEYS);assert.deepEqual(Object.keys(one.booking).sort(),SCAN_BOOKING_KEYS);
  const two=demoScanGift(data,c.serial.toLowerCase(),staff);
  assert.equal(two.kind,'prescription');assert.equal(two.name,'Sample claimant');assert.equal(two.email,'claim@example.com');assert.equal(two.number,'EYC-AMO-'+c.serial);assert.equal(two.booking,null);
  for(const v of [one,two]){const text=JSON.stringify(v);for(const k of ['phone','insurance','policy','health','documents','gross','net','commission'])assert.ok(!text.toLowerCase().includes(k),k+' is never shown on a scan');}
  assert.throws(()=>demoScanGift(data,c.serial,{role:'affiliate',affiliateId:'demo-alex'}),/Staff access/);
  assert.throws(()=>demoScanGift(data,c.serial,null),/Staff access/);
  assert.throws(()=>demoScanGift(data,'EYC-AMO-ZZZZZZ',staff),/No gift card/);
  assert.equal(giftScanView({kind:'prescription',number:'n',status:'Issued',issuedAt:'2020-01-01T00:00:00Z',expiresAt:'2020-06-29T00:00:00Z',name:'a',email:'b'}).expired,true);
});
test('the gift card page, scan route and sign-in return are staff-gated',()=>{
  const route=readFileSync(new URL('../app/api/gift/scan/route.js',import.meta.url),'utf8');
  assert.ok(route.includes('identity(request);requireStaff(user)')&&route.includes('sameOrigin(request)')&&route.includes("audit(user.db,user.id,'gift-card-scan',serial)"));
  const page=readFileSync(new URL('../components/gift-card-page.js',import.meta.url),'utf8');
  assert.ok(page.includes("ready && user?.role === 'staff'")&&page.includes('<StaffView number={shown} />'),'details only for signed-in staff');
  assert.ok(readFileSync(new URL('../app/gift/[number]/page.js',import.meta.url),'utf8').includes('robots:{index:false,follow:false}'));
  const login=readFileSync(new URL('../components/login-form.js',import.meta.url),'utf8');
  assert.ok(login.includes("/^\\/gift\\/[A-Za-z0-9-]{6,20}$/.test(params.get('next')||'')"),'only a gift card page is accepted as the return address');
  const mail=readFileSync(new URL('../lib/notifications.js',import.meta.url),'utf8');
  assert.equal((mail.match(/giftCardPath\(giftNumber\(affiliate,/g)||[]).length,2,'both gift emails link to the card');
});
test('the server finds a scanned card on a booking or a prescription claim without errors',()=>{
  const script=`
    const { scanGiftCard } = await import(${JSON.stringify(new URL('../lib/server.js',import.meta.url).href)});
    const rows = { bookings: { name: 'Sample patient', email: 'p@example.com', phone: '+1', policy_encrypted: 'x', reference: '7K2M9QXB', service: 'eye-exam', doctor: 'doctor-1', start: '2026-11-02T16:00:00Z', status: 'Booked', affiliate_id: 'a1', gift_serial: '7K2M9Q', gift_issued_at: '2026-10-26T07:00:00Z', gift_expires_at: '2999-01-01T00:00:00Z', gift_status: 'Issued' },
      gift_claims: { name: 'Sample claimant', email: 'c@example.com', health_card: 'x', serial: 'B4XW8T', issued_at: '2026-10-26T07:00:00Z', expires_at: '2999-01-01T00:00:00Z', status: 'Issued', affiliate_id: 'a1' },
      affiliates: { name: 'Alex Morgan', gift_code: null } };
    const db = { from: table => { let match = true; const q = { select: () => q, eq: (k, v) => { if (k !== 'id') match = rows[table][k] === v; return q; }, maybeSingle: async () => ({ data: match ? rows[table] : null }) }; return q; } };
    console.log(JSON.stringify({ booking: await scanGiftCard(db, '7K2M9Q'), claim: await scanGiftCard(db, 'B4XW8T'), none: await scanGiftCard(db, 'ZZZZZZ') }));`;
  const out=JSON.parse(execFileSync(process.execPath,['--conditions=react-server','--input-type=module','-e',script],{encoding:'utf8'}).trim().split('\n').pop());
  assert.equal(out.booking.kind,'booking');assert.equal(out.booking.number,'EYC-AMO-7K2M9Q');assert.equal(out.booking.booking.reference,'7K2M9QXB');
  assert.equal(out.claim.kind,'prescription');assert.equal(out.claim.number,'EYC-AMO-B4XW8T');assert.equal(out.claim.booking,null);assert.equal(out.none,null);
  assert.deepEqual(Object.keys(out.booking).sort(),SCAN_KEYS);assert.ok(!JSON.stringify(out).includes('policy')&&!JSON.stringify(out).includes('health')&&!JSON.stringify(out).includes('phone'));
});

// Redeeming gift cards (staff): the state in the bookings list and the redeem / undo control.
import { giftState,checkRedeem } from '../lib/gift.js';
test('gift card state and redeem rules',()=>{
  const future='2999-01-01T00:00:00Z',past='2020-01-01T00:00:00Z';
  assert.equal(giftState({status:'Issued',expiresAt:future}),'Not redeemed');assert.equal(giftState({status:'Claimed',expiresAt:future}),'Not redeemed');
  assert.equal(giftState({status:'Issued',expiresAt:past}),'Expired');assert.equal(giftState({status:'Redeemed',expiresAt:past}),'Redeemed','a redeemed card stays redeemed after expiry');
  assert.equal(giftState({status:'Void',expiresAt:future}),'Void');
  assert.equal(checkRedeem({status:'Issued',expiresAt:future},true).ok,true);
  assert.match(checkRedeem({status:'Redeemed',expiresAt:future},true).message,/already been redeemed/);
  assert.match(checkRedeem({status:'Issued',expiresAt:past},true).message,/expired/);
  assert.match(checkRedeem({status:'Void',expiresAt:future},true).message,/void/);
  assert.equal(checkRedeem({status:'Redeemed',expiresAt:past},false).ok,true,'a mistake can be undone');
  assert.match(checkRedeem({status:'Issued',expiresAt:future},false).message,/not been redeemed/);
  assert.match(checkRedeem(null,true).message,/No gift card/);
});
test('staff redeem and undo booking and prescription cards in the demo; only once, never expired',()=>{
  const staff={role:'staff'};
  let data=applyDemo(seedDemo(),'booking',validateBooking({...at(seedDemo().slots[2]),affiliateId:'demo-alex'}),null);
  data=applyDemo(data,'claim',{name:'Sample claimant',email:'claim@example.com',affiliateId:'demo-alex'},null);
  const booked='EYC-AMO-'+data.bookings[0].giftCard.serial,claimed=data.giftClaims[0].serial;
  assert.throws(()=>applyDemo(data,'gift-redeem',{number:booked},{role:'affiliate',affiliateId:'demo-alex'}),/Staff access/);
  let next=applyDemo(data,'gift-redeem',{number:booked},staff);
  assert.equal(next.bookings[0].giftCard.status,'Redeemed');assert.ok(next.bookings[0].giftCard.redeemedAt);
  const scan=demoScanGift(next,booked,staff);assert.equal(scan.status,'Redeemed');assert.ok(scan.redeemedAt);
  assert.throws(()=>applyDemo(next,'gift-redeem',{number:booked},staff),/already been redeemed/);
  next=applyDemo(next,'gift-redeem',{number:booked,redeemed:false},staff);
  assert.equal(next.bookings[0].giftCard.status,'Issued');assert.equal(next.bookings[0].giftCard.redeemedAt,null);
  next=applyDemo(next,'gift-redeem',{number:claimed},staff);assert.equal(next.giftClaims[0].status,'Redeemed');
  next.bookings[0].giftCard.expiresAt='2020-01-01T00:00:00Z';
  assert.throws(()=>applyDemo(next,'gift-redeem',{number:booked},staff),/expired/);
  assert.throws(()=>applyDemo(next,'gift-redeem',{number:'nope'},staff),/not an Eyecon gift card/);
});
test('redeeming: migration 013, the workspace action, the bookings list and the scan page',()=>{
  const sql=readFileSync(new URL('../supabase/migrations/013_gift_redemption.sql',import.meta.url),'utf8');
  assert.ok(sql.startsWith('--')&&sql.includes('after 012_prescription_gift_claims.sql')&&sql.includes('gift_redeemed_at timestamptz')&&sql.includes('redeemed_by uuid'));
  assert.ok(sql.includes("((gift_status = 'Redeemed') = (gift_redeemed_at is not null))")&&sql.includes("((status = 'Redeemed') = (redeemed_at is not null))"));
  const route=readFileSync(new URL('../app/api/workspace/route.js',import.meta.url),'utf8');
  const branch=route.slice(route.indexOf("action==='gift-redeem'"),route.indexOf("action==='pricing'"));
  assert.ok(route.indexOf('requireStaff(u);')<route.indexOf("action==='gift-redeem'"),'staff only');
  assert.ok(branch.includes('setGiftRedeemed(db,serial,p.redeemed!==false,u.id)')&&branch.includes("audit(db,u.id,p.redeemed!==false?'gift-redeem':'gift-redeem-undo',serial)"));
  const ws=readFileSync(new URL('../components/workspace.js',import.meta.url),'utf8');
  assert.ok(ws.includes("<td>{b.source}{b.giftCard&&<GiftBadge card={b.giftCard}/>}</td>")&&ws.includes('<RedeemGift number={giftNumber('));
  assert.ok(readFileSync(new URL('../components/gift-card-page.js',import.meta.url),'utf8').includes('<RedeemGift number={card.number} card={card} />'));
});
test('the server redeems and un-redeems a gift card without errors',()=>{
  const script=`
    const { setGiftRedeemed } = await import(${JSON.stringify(new URL('../lib/server.js',import.meta.url).href)});
    const writes = [];
    const make = (booking, claim) => ({ from: table => { const q = { select: () => q, eq: () => q, is: () => q, in: () => q,
      maybeSingle: async () => ({ data: table === 'bookings' ? booking : table === 'gift_claims' ? claim : table === 'affiliates' ? { name: 'Alex Morgan', gift_code: null } : null }),
      update: fields => { writes.push([table, fields]); if (table === 'bookings' && booking) Object.assign(booking, fields); if (table === 'gift_claims' && claim) Object.assign(claim, fields);
        const u = { eq: () => u, select: async () => ({ data: [{ id: 'x' }], error: null }) }; return u; } }; return q; } });
    const b = { id: 'b1', name: 'Sample patient', email: 'p@example.com', reference: '7K2M9QXB', service: 'eye-exam', doctor: 'doctor-1', start: '2026-11-02T16:00:00Z', status: 'Booked', affiliate_id: 'a1', gift_serial: '7K2M9Q', gift_issued_at: '2026-10-26T07:00:00Z', gift_expires_at: '2999-01-01T00:00:00Z', gift_status: 'Issued' };
    const one = await setGiftRedeemed(make(b, null), '7K2M9Q', true, 'staff-1');
    let again = ''; try { await setGiftRedeemed(make(b, null), '7K2M9Q', true, 'staff-1'); } catch (e) { again = e.status + ' ' + e.message; }
    const undo = await setGiftRedeemed(make(b, null), '7K2M9Q', false, 'staff-1');
    const c = { id: 'c1', name: 'Sample claimant', email: 'c@example.com', serial: 'B4XW8T', issued_at: '2026-10-26T07:00:00Z', expires_at: '2999-01-01T00:00:00Z', status: 'Issued', affiliate_id: 'a1' };
    const two = await setGiftRedeemed(make(null, c), 'B4XW8T', true, 'staff-1');
    console.log(JSON.stringify({ one: one.status, oneAt: !!one.redeemedAt, again, undo: undo.status, two: two.status, kind: two.kind, writes }));`;
  const out=JSON.parse(execFileSync(process.execPath,['--conditions=react-server','--input-type=module','-e',script],{encoding:'utf8'}).trim().split('\n').pop());
  assert.equal(out.one,'Redeemed');assert.equal(out.oneAt,true);assert.match(out.again,/^409 This gift card has already been redeemed/);
  assert.equal(out.undo,'Issued');assert.equal(out.two,'Redeemed');assert.equal(out.kind,'prescription');
  assert.equal(out.writes[0][1].gift_redeemed_by,'staff-1');assert.equal(out.writes[1][1].gift_redeemed_at,null);
});

// The card page's public status: a redeemed or expired card stops showing a usable QR code.
import { giftPublicStatus,PUBLIC_STATUS_KEYS } from '../lib/gift.js';
import { demoGiftStatus } from '../lib/demo.js';
test('the card page shows anyone only the card state and dates, and only for the full number',()=>{
  let data=applyDemo(seedDemo(),'booking',validateBooking({...at(seedDemo().slots[2]),affiliateId:'demo-alex'}),null);
  const number='EYC-AMO-'+data.bookings[0].giftCard.serial;
  const fresh=demoGiftStatus(data,number);assert.equal(fresh.state,'Not redeemed');assert.deepEqual(Object.keys(fresh).sort(),PUBLIC_STATUS_KEYS);
  assert.equal(demoGiftStatus(data,number.toLowerCase()).state,'Not redeemed');
  assert.equal(demoGiftStatus(data,data.bookings[0].giftCard.serial),null,'a bare serial shows nothing');
  assert.equal(demoGiftStatus(data,'EYC-XYZ-'+data.bookings[0].giftCard.serial),null,'the affiliate code must match');
  data=applyDemo(data,'gift-redeem',{number},{role:'staff'});
  const used=demoGiftStatus(data,number);assert.equal(used.state,'Redeemed');assert.ok(used.redeemedAt);
  data.bookings[0].giftCard.status='Issued';data.bookings[0].giftCard.expiresAt='2020-01-01T00:00:00Z';
  assert.equal(demoGiftStatus(data,number).state,'Expired');
  assert.ok(!JSON.stringify(demoGiftStatus(data,number)).includes('@'),'no email or name');
  assert.equal(giftPublicStatus('EYC-AMO-7K2M9Q',null),null);
  const page=readFileSync(new URL('../components/gift-card-page.js',import.meta.url),'utf8');
  assert.ok(page.includes("usable = !status.loading && !status.missing && (!status.card || s === 'Not redeemed')")&&page.includes('className="gift-stamp"'),'QR only while the card can be used');
  const route=readFileSync(new URL('../app/api/gift/status/route.js',import.meta.url),'utf8');
  assert.ok(route.includes('sameOrigin(request)')&&route.includes('giftStatus(adminClient()'));
});
test('the server reports a card status without errors and without patient details',()=>{
  const script=`
    const { giftStatus } = await import(${JSON.stringify(new URL('../lib/server.js',import.meta.url).href)});
    const rows = { bookings: { affiliate_id: 'a1', gift_status: 'Redeemed', gift_expires_at: '2999-01-01T00:00:00Z', gift_redeemed_at: '2026-10-27T18:00:00Z', gift_serial: '7K2M9Q' }, gift_claims: null, affiliates: { name: 'Alex Morgan', gift_code: null } };
    const selects = [];
    const db = { from: table => { const q = { select: cols => { selects.push(cols); return q; }, eq: () => q, maybeSingle: async () => ({ data: rows[table] }) }; return q; } };
    console.log(JSON.stringify({ ok: await giftStatus(db, 'EYC-AMO-7K2M9Q'), wrong: await giftStatus(db, 'EYC-XYZ-7K2M9Q'), bad: await giftStatus(db, 'hello'), selects }));`;
  const out=JSON.parse(execFileSync(process.execPath,['--conditions=react-server','--input-type=module','-e',script],{encoding:'utf8'}).trim().split('\n').pop());
  assert.deepEqual(out.ok,{state:'Redeemed',expiresAt:'2999-01-01T00:00:00Z',redeemedAt:'2026-10-27T18:00:00Z'});
  assert.equal(out.wrong,null);assert.equal(out.bad,null);
  assert.ok(!out.selects.some(c=>/name,email|email|phone/.test(c.replace('name,gift_code',''))),'never reads patient details');
});

test('“Book online in under a minute.” is fine print at every screen size',()=>{
  const css=readFileSync(new URL('../app/site.css',import.meta.url),'utf8');
  const rule=/\n\.hero-rating\.hero-fineprint \{([^}]*)\}/.exec(css);
  assert.ok(rule,'a rule outside any media query');
  assert.ok(/font-size: \.78rem/.test(rule[1])&&/font-weight: 300/.test(rule[1])&&/rgba\(255, 255, 255, \.55\)/.test(rule[1]));
  assert.ok(css.indexOf(rule[0])>css.indexOf('.hero-rating { display: inline-flex'),'after the rating line it overrides');
});
