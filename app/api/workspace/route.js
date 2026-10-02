import { identity, requireStaff, sameOrigin, fail, mapBooking, mapAffiliate, encryptPolicy, audit } from '@/lib/server';
import { clean, validateStatus, validateSlug, validateBooking, safePhoto } from '@/lib/validation';
import { claimAndSend } from '@/lib/notifications';
import { clinic } from '@/lib/config';
export const dynamic='force-dynamic';
export async function GET(request){
  try{const u=await identity(request);const db=u.db;
    if(u.role==='affiliate'){
      const [a,b]=await Promise.all([db.from('affiliates').select('*').eq('id',u.affiliateId).single(),db.from('bookings').select('id,name,status,start,commission,payout,paid_at').eq('affiliate_id',u.affiliateId).order('start',{ascending:false})]);
      if(a.error||b.error)throw new Error('Unable to load your referrals.');
      return Response.json({user:{role:u.role,affiliateId:u.affiliateId},affiliates:[mapAffiliate(a.data)],bookings:b.data.map(r=>({...r,commission:Number(r.commission),paidAt:r.paid_at})),templates:[],slots:[]},{headers:{'Cache-Control':'no-store'}});
    }
    requireStaff(u);
    const [a,b,t,s,j]=await Promise.all([db.from('affiliates').select('*').order('created_at'),db.from('bookings').select('*').order('start',{ascending:false}).limit(2000),db.from('message_templates').select('*').order('id'),db.rpc('available_slots'),db.from('notification_jobs').select('booking_id,kind,status,result,created_at').order('created_at',{ascending:false}).limit(100)]);
    if(a.error||b.error||t.error||s.error||j.error)throw new Error('Unable to load the workspace.');
    return Response.json({user:{role:'staff'},affiliates:a.data.map(mapAffiliate),bookings:b.data.map(mapBooking),templates:t.data,slots:s.data,jobs:j.data},{headers:{'Cache-Control':'no-store'}});
  }catch(e){return fail(e,401);}
}
export async function POST(request){
  try{sameOrigin(request);const u=await identity(request),db=u.db;
    if(request.headers.get('content-type')?.includes('multipart/form-data')){
      const form=await request.formData(),file=form.get('file'),id=u.role==='affiliate'?u.affiliateId:String(form.get('affiliateId'));
      if(!file || typeof file.arrayBuffer!=='function' || file.size>2*1024*1024 || !['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Upload a JPG, PNG or WebP image smaller than 2 MB.');
      const bytes=Buffer.from(await file.arrayBuffer());const valid=(file.type==='image/png'&&bytes.subarray(0,8).toString('hex')==='89504e470d0a1a0a')||(file.type==='image/jpeg'&&bytes[0]===255&&bytes[1]===216)||(file.type==='image/webp'&&bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP');if(!valid)throw new Error('The file does not match its image type.');
      const {data:a}=await db.from('affiliates').select('id').eq('id',id).single();if(!a)throw new Error('Affiliate not found.');
      const key=id+'/'+crypto.randomUUID()+'.'+(file.type==='image/jpeg'?'jpg':file.type.split('/')[1]);const {error}=await db.storage.from('affiliate-photos').upload(key,bytes,{contentType:file.type});if(error)throw new Error('Could not upload this image.');
      const {data:url}=db.storage.from('affiliate-photos').getPublicUrl(key);const {error:update}=await db.from('affiliates').update({photo:url.publicUrl}).eq('id',id);if(update)throw new Error('Could not save this image.');await audit(db,u.id,'photo',id);return Response.json({ok:true});
    }
    const {action,payload:p}=await request.json();let error=null;
    if(action==='profile'){
      const id=u.role==='affiliate'?u.affiliateId:p.id;const name=clean(p.name,120);if(name.length<2)throw new Error('Please enter a name.');({error}=await db.from('affiliates').update({name,bio:clean(p.bio,500)}).eq('id',id));
    }else{
      requireStaff(u);
      if(action==='status'){
        const status=validateStatus(p.status);({error}=await db.from('bookings').update({status}).eq('id',p.id));
        if(!error&&status==='No-show'){const {data:b}=await db.from('bookings').select('*').eq('id',p.id).single();if(b)await claimAndSend(db,mapBooking(b),'no-show');}
      }else if(action==='commission'){
        const amount=Number(p.amount);if(!Number.isFinite(amount)||amount<0||amount>100000)throw new Error('Enter a valid commission amount.');
        const result=await db.from('bookings').update({commission:amount}).eq('id',p.id).eq('status','Attended').neq('payout','Paid').not('affiliate_id','is',null).select('id');error=result.error;if(!error&&!result.data.length)throw new Error('Only unpaid attended referrals can receive commission.');
      }else if(action==='payout'){
        if(!Array.isArray(p.ids)||!p.ids.length||p.ids.length>100)throw new Error('Select up to 100 referrals.');({error}=await db.rpc('approve_payout',{p_ids:p.ids,p_actor:u.id}));
      }else if(action==='affiliate'){
        const name=clean(p.name,120),email=clean(p.email,254);if(name.length<2||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('Enter a name and valid email.');const slug=validateSlug(p.slug);const rate=Number(p.commissionRate||0);if(!Number.isFinite(rate)||rate<0||rate>100)throw new Error('Commission rate must be between 0 and 100.');
        const {data:exists}=await db.from('affiliates').select('id').eq('slug',slug).maybeSingle();if(exists)throw new Error('That referral page name already exists.');
        const {data:invite,error:inviteError}=await db.auth.admin.inviteUserByEmail(email,{redirectTo:clinic.site+'/login?set-password=1'});if(inviteError)throw new Error('Could not invite this email. Check whether it already has an account.');
        const {data:a,error:ae}=await db.from('affiliates').insert({name,email,slug,bio:clean(p.bio,500),photo:safePhoto(p.photo),commission_rate:rate,commission_note:clean(p.commissionNote,300)}).select('id').single();
        if(ae)throw new Error('The invitation was sent, but the affiliate record could not be created. Staff must review this account in Supabase.');
        const {error:pe}=await db.from('profiles').insert({id:invite.user.id,role:'affiliate',affiliate_id:a.id});if(pe){await db.from('affiliates').update({active:false}).eq('id',a.id);throw new Error('The invitation was sent, but workspace access could not be created. Staff must review this inactive account in Supabase.');}
      }else if(action==='toggle-affiliate'){
        const {data:a}=await db.from('affiliates').select('active').eq('id',p.id).single();if(!a)throw new Error('Affiliate not found.');({error}=await db.from('affiliates').update({active:!a.active}).eq('id',p.id));
      }else if(action==='template'){
        const subject=clean(p.subject,150),body=clean(p.body,3000);if(!subject||!body)throw new Error('Enter a subject and message.');({error}=await db.from('message_templates').update({subject,body}).eq('id',p.id));
      }else if(action==='slot'){
        const start=new Date(p.start),duration=Number(p.duration);if(!Number.isFinite(start.getTime())||start<=new Date()||![15,30,45,60,90].includes(duration))throw new Error('Choose a future time and a valid duration.');({error}=await db.from('appointment_slots').insert({start:start.toISOString(),duration}));
      }else if(action==='booking'){
        const b=validateBooking(p,true);const {data,error:e}=await db.rpc('create_booking',{p_name:b.name,p_email:b.email,p_phone:b.phone,p_start:b.start,p_service:b.service,p_affiliate:b.affiliateId,p_source:b.source,p_first_visit:b.firstVisit,p_insurance:b.insurance,p_policy:encryptPolicy(b.policy),p_brands:b.brands,p_sms:b.smsConsent,p_request_hash:null});error=e;if(!e)await claimAndSend(db,mapBooking(data[0]),'confirmation');
      }else throw new Error('Unknown action.');
    }
    if(error)throw new Error('Could not save the change. Check the selected records and try again.');await audit(db,u.id,action,p.id||'batch');return Response.json({ok:true});
  }catch(e){return fail(e);}
}
