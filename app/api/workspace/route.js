import { identity, requireStaff, requireClinic, loadTeam, inviteTeamMember, setTeamActive, sameOrigin, fail, mapBooking, mapAffiliate, mapPricing, encryptPolicy, audit, issueGift, issueDocumentToken, loadDoctorDirectory, loadSchedules, setGiftRedeemed } from '@/lib/server';
import { parseGiftNumber } from '@/lib/gift';
import { publicDoctor } from '@/lib/schedule';
import { clean, validateStatus, validateSlug, validateBooking, safePhoto, validateGiftCode, validateDoctor, inviteErrorMessage } from '@/lib/validation';
import { claimAndSend } from '@/lib/notifications';
import { clinic, documentsLink, services } from '@/lib/config';
import { validateCompletion, validatePricing } from '@/lib/commission';
import { AFFILIATE_COLUMNS, restrictAffiliateRow } from '@/lib/affiliate';
import { FRONT_DESK_ROLE, canAct, frontDeskView } from '@/lib/front-desk';
export const dynamic='force-dynamic';
export async function GET(request){
  try{const u=await identity(request);const db=u.db;const doctors=await loadDoctorDirectory(db);
    // Affiliates get only their own referrals, as the restricted rows in lib/affiliate.js (id, name, status, start,
    // commission, payout, paid_at): never contact details, service, insurance, documents or procedure amounts.
    if(u.role==='affiliate'){
      const [a,b]=await Promise.all([db.from('affiliates').select('*').eq('id',u.affiliateId).single(),db.from('bookings').select(AFFILIATE_COLUMNS).eq('affiliate_id',u.affiliateId).order('start',{ascending:false})]);
      if(a.error||b.error)throw new Error('Unable to load your referrals.');
      return Response.json({user:{role:u.role,affiliateId:u.affiliateId},affiliates:[mapAffiliate(a.data)],bookings:b.data.map(restrictAffiliateRow),templates:[],slots:[],doctors:doctors.map(d=>({...publicDoctor(d),visible:d.visible}))},{headers:{'Cache-Control':'no-store'}});
    }
    // Staff admin and the front desk. The front desk's data goes through frontDeskView (lib/front-desk.js) before it is
    // sent: no commission, payout, rate or procedure amounts, and no pricing, templates, delivery log or team.
    requireClinic(u);const desk=u.role===FRONT_DESK_ROLE,none={data:[],error:null};
    const [a,b,t,s,j]=await Promise.all([db.from('affiliates').select('*').order('created_at'),db.from('bookings').select('*').order('start',{ascending:false}).limit(2000),desk?none:db.from('message_templates').select('*').order('id'),db.rpc('available_slots'),desk?none:db.from('notification_jobs').select('booking_id,kind,status,result,created_at').order('created_at',{ascending:false}).limit(100)]);
    if(a.error||b.error||t.error||s.error||j.error)throw new Error('Unable to load the workspace.');
    // Uploaded documents for these bookings (names and sizes only; never storage paths). Before migration 005 has run
    // the table is missing, so the workspace still loads, just without documents.
    const d=await db.from('booking_documents').select('id,booking_id,kind,original_name,size,mime,uploaded_at').order('uploaded_at').limit(16000);
    if(d.error)console.error('Documents not loaded:',d.error.code);
    const docs=new Map();for(const r of d.data||[])docs.set(r.booking_id,[...(docs.get(r.booking_id)||[]),r]);
    const giftClaims=await loadGiftClaims(db);
    if(desk)return Response.json(frontDeskView({affiliates:a.data.map(mapAffiliate),bookings:b.data.map(r=>mapBooking(r,docs.get(r.id))),giftClaims,slots:s.data,doctors:doctors.map(d=>({...publicDoctor(d),visible:d.visible}))}),{headers:{'Cache-Control':'no-store'}});
    // Procedure prices (migration 007). Missing before it has run: the workspace still loads, with no prices.
    const pr=await db.from('procedure_costs').select('*');if(pr.error)console.error('Pricing not loaded:',pr.error.code);
    // Optometrists with their schedules (migration 010), for Staff admin > Doctors.
    const schedules=await loadSchedules(db);
    // Front desk members (migration 015), for Staff admin > Team.
    const team=await loadTeam(db);
    return Response.json({user:{role:'staff'},team,procedureCosts:(pr.data||[]).map(mapPricing),affiliates:a.data.map(mapAffiliate),bookings:b.data.map(r=>mapBooking(r,docs.get(r.id))),giftClaims,templates:t.data,slots:s.data,jobs:j.data,doctors,...schedules},{headers:{'Cache-Control':'no-store'}});
  }catch(e){return fail(e,401);}
}
// Prescription gift cards (migration 012), for the Gift cards page. Names, emails and card dates only: never the
// health card, insurance or policy.
async function loadGiftClaims(db){
  const gc=await db.from('gift_claims').select('id,affiliate_id,serial,name,email,issued_at,expires_at,status,redeemed_at').order('issued_at',{ascending:false}).limit(2000);if(gc.error)console.error('Gift claims not loaded:',gc.error.code);
  return (gc.data||[]).map(c=>({id:c.id,affiliateId:c.affiliate_id,serial:c.serial,name:c.name,email:c.email,issuedAt:c.issued_at,expiresAt:c.expires_at,status:c.status,redeemedAt:c.redeemed_at}));
}
export async function POST(request){
  try{sameOrigin(request);const u=await identity(request),db=u.db;await loadDoctorDirectory(db);
    // The front desk may use only the actions in FRONT_DESK_ACTIONS (lib/front-desk.js): never photos or profiles.
    const refused=()=>Object.assign(new Error('Staff access is required.'),{status:403});
    if(request.headers.get('content-type')?.includes('multipart/form-data')){
      if(u.role===FRONT_DESK_ROLE)throw refused();
      const form=await request.formData(),file=form.get('file'),id=u.role==='affiliate'?u.affiliateId:String(form.get('affiliateId'));
      if(!file || typeof file.arrayBuffer!=='function' || file.size>2*1024*1024 || !['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Upload a JPG, PNG or WebP image smaller than 2 MB.');
      const bytes=Buffer.from(await file.arrayBuffer());const valid=(file.type==='image/png'&&bytes.subarray(0,8).toString('hex')==='89504e470d0a1a0a')||(file.type==='image/jpeg'&&bytes[0]===255&&bytes[1]===216)||(file.type==='image/webp'&&bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP');if(!valid)throw new Error('The file does not match its image type.');
      const {data:a}=await db.from('affiliates').select('id').eq('id',id).single();if(!a)throw new Error('Affiliate not found.');
      const key=id+'/'+crypto.randomUUID()+'.'+(file.type==='image/jpeg'?'jpg':file.type.split('/')[1]);const {error}=await db.storage.from('affiliate-photos').upload(key,bytes,{contentType:file.type});if(error)throw new Error('Could not upload this image.');
      const {data:url}=db.storage.from('affiliate-photos').getPublicUrl(key);const {error:update}=await db.from('affiliates').update({photo:url.publicUrl}).eq('id',id);if(update)throw new Error('Could not save this image.');await audit(db,u.id,'photo',id);return Response.json({ok:true});
    }
    const {action,payload:p}=await request.json();let error=null;
    if(u.role===FRONT_DESK_ROLE&&!canAct(u.role,action))throw refused();
    if(action==='profile'){
      const id=u.role==='affiliate'?u.affiliateId:p.id;const name=clean(p.name,120);if(name.length<2)throw new Error('Please enter a name.');({error}=await db.from('affiliates').update({name,bio:clean(p.bio,500)}).eq('id',id));
    }else{
      requireClinic(u);if(!canAct(u.role,action))throw refused();
      if(action==='status'){
        const status=validateStatus(p.status);({error}=await db.from('bookings').update({status}).eq('id',p.id));
        if(!error&&status==='No-show'){const {data:b}=await db.from('bookings').select('*').eq('id',p.id).single();if(b)await claimAndSend(db,mapBooking(b),'no-show');}
      }else if(action==='complete'){
        // Staff send only what the patient was billed and the discount. The database snapshots the operation cost and
        // the affiliate's rate, calculates net and commission, marks the visit Attended and writes the audit entry.
        const {gross,discount}=validateCompletion(p);
        const {error:ce}=await db.rpc('complete_appointment',{p_id:String(p.id||''),p_gross:gross,p_discount:discount,p_actor:u.id});
        if(ce)throw new Error(ce.message.includes('locked')?'This referral has been paid, so its commission is locked.':ce.message.includes('not found')?'Booking not found.':'Could not save this appointment. Check the amounts and try again.');
        return Response.json({ok:true});
      }else if(action==='gift-redeem'){
        // Mark a gift card redeemed when the patient uses it, or undo a mistake (p.redeemed false). By card number.
        const serial=parseGiftNumber(p.number);if(!serial)throw new Error('That is not an Eyecon gift card number.');
        const card=await setGiftRedeemed(db,serial,p.redeemed!==false,u.id);
        await audit(db,u.id,p.redeemed!==false?'gift-redeem':'gift-redeem-undo',serial);return Response.json({ok:true,card});
      }else if(action==='pricing'){
        if(!services.some(s=>s.id===p.service))throw new Error('Unknown procedure.');
        const {retailPrice,operationCost}=validatePricing(p);
        ({error}=await db.from('procedure_costs').upsert({service:p.service,retail_price:retailPrice,operation_cost:operationCost,updated_at:new Date().toISOString()}));
      }else if(action==='payout'){
        if(!Array.isArray(p.ids)||!p.ids.length||p.ids.length>100)throw new Error('Select up to 100 referrals.');({error}=await db.rpc('approve_payout',{p_ids:p.ids,p_actor:u.id}));
      }else if(action==='affiliate'){
        const name=clean(p.name,120),email=clean(p.email,254);if(name.length<2||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('Enter a name and valid email.');const slug=validateSlug(p.slug);const rate=Number(p.commissionRate||0);if(!Number.isFinite(rate)||rate<0||rate>100)throw new Error('Commission rate must be between 0 and 100.');const giftCode=validateGiftCode(p.code);
        const {data:exists}=await db.from('affiliates').select('id').eq('slug',slug).maybeSingle();if(exists)throw new Error('That referral page name already exists.');
        const {data:invite,error:inviteError}=await db.auth.admin.inviteUserByEmail(email,{redirectTo:clinic.site+'/login?set-password=1'});if(inviteError){console.error('Affiliate invite failed:',inviteError.code||inviteError.status);throw new Error(inviteErrorMessage(inviteError));}
        const {data:a,error:ae}=await db.from('affiliates').insert({name,email,slug,bio:clean(p.bio,500),photo:safePhoto(p.photo),commission_rate:rate,commission_note:clean(p.commissionNote,300),...(giftCode?{gift_code:giftCode}:{})}).select('id').single();
        if(ae)throw new Error('The invitation was sent, but the affiliate record could not be created. Staff must review this account in Supabase.');
        const {error:pe}=await db.from('profiles').insert({id:invite.user.id,role:'affiliate',affiliate_id:a.id});if(pe){await db.from('affiliates').update({active:false}).eq('id',a.id);throw new Error('The invitation was sent, but workspace access could not be created. Staff must review this inactive account in Supabase.');}
      }else if(action==='team-invite'){
        // Staff admin > Team: a front desk member gets an email to set their password, then signs in to /desk.
        await inviteTeamMember(db,p,clinic.site+'/login?set-password=1');await audit(db,u.id,'team-invite',clean(p.email,254));return Response.json({ok:true});
      }else if(action==='team-toggle'){
        const t=await setTeamActive(db,p.id);await audit(db,u.id,t.active?'team-activate':'team-deactivate',t.id);return Response.json({ok:true});
      }else if(action==='toggle-affiliate'){
        const {data:a}=await db.from('affiliates').select('active').eq('id',p.id).single();if(!a)throw new Error('Affiliate not found.');({error}=await db.from('affiliates').update({active:!a.active}).eq('id',p.id));
      }else if(action==='template'){
        const subject=clean(p.subject,150),body=clean(p.body,3000);if(!subject||!body)throw new Error('Enter a subject and message.');({error}=await db.from('message_templates').update({subject,body}).eq('id',p.id));
      }else if(action==='slot'){
        const start=new Date(p.start),duration=Number(p.duration);if(!Number.isFinite(start.getTime())||start<=new Date()||![15,30,45,60,90].includes(duration))throw new Error('Choose a future time and a valid duration.');const doctor=validateDoctor(p.doctor);({error}=await db.from('appointment_slots').insert({doctor,start:start.toISOString(),duration}));if(error?.code==='23505')throw new Error('This optometrist already has this time.');
      }else if(action==='booking'){
        const b=validateBooking(p,true);const {data,error:e}=await db.rpc('create_booking',{p_name:b.name,p_email:b.email,p_phone:b.phone,p_doctor:b.doctor,p_start:b.start,p_service:b.service,p_affiliate:b.affiliateId,p_source:b.source,p_first_visit:b.firstVisit,p_insurance:b.insurance,p_policy:encryptPolicy(b.policy),p_brands:b.brands,p_sms:b.smsConsent,p_request_hash:null});error=e;if(!e){const token=await issueDocumentToken(db,data[0]);await claimAndSend(db,{...mapBooking(await issueGift(db,data[0])),documentsLink:documentsLink(token)},'confirmation');}
      }else if(action==='document-url'){
        // A signed link to one uploaded document, valid for 5 minutes. Only staff reach this point.
        const {data:doc}=await db.from('booking_documents').select('id,booking_id,file_path').eq('id',String(p.id||'')).maybeSingle();if(!doc)throw new Error('Document not found.');
        const {data:signed,error:se}=await db.storage.from('booking-documents').createSignedUrl(doc.file_path,300);if(se||!signed?.signedUrl)throw new Error('This document could not be opened. Please try again.');
        await audit(db,u.id,'document-view',doc.id);return Response.json({url:signed.signedUrl},{headers:{'Cache-Control':'no-store'}});
      }else throw new Error('Unknown action.');
    }
    if(error)throw new Error('Could not save the change. Check the selected records and try again.');await audit(db,u.id,action,p.id||'batch');return Response.json({ok:true});
  }catch(e){return fail(e,e.status||400);}
}
