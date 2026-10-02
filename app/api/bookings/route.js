import { createHash } from 'node:crypto';
import { DEMO } from '@/lib/config';
import { validateBooking } from '@/lib/validation';
import { adminClient, encryptPolicy, mapBooking, sameOrigin, fail } from '@/lib/server';
import { claimAndSend } from '@/lib/notifications';
export async function POST(request) {
  try{
    sameOrigin(request);if(DEMO)return fail(new Error('Use the browser demo booking flow.'),409);
    const raw=await request.json();if(raw.website)return fail(new Error('Unable to process this booking.'));
    if(!process.env.TURNSTILE_SECRET_KEY)throw new Error('Online booking verification is not configured. Please contact the clinic.');
    const verify=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body:new URLSearchParams({secret:process.env.TURNSTILE_SECRET_KEY,response:String(raw.captcha||'')}),signal:AbortSignal.timeout(10000)}).then(r=>r.json());
    if(!verify.success || verify.hostname!==new URL(request.url).hostname || verify.action!=='booking')throw new Error('Please complete the booking verification and try again.');
    const b=validateBooking(raw),db=adminClient();
    const requestHash=createHash('sha256').update((request.headers.get('x-forwarded-for')?.split(',')[0]||'unknown')+process.env.SUPABASE_SERVICE_ROLE_KEY).digest('hex');
    const {data,error}=await db.rpc('create_booking',{p_name:b.name,p_email:b.email,p_phone:b.phone,p_start:b.start,p_service:b.service,p_affiliate:b.affiliateId,p_source:b.source,p_first_visit:b.firstVisit,p_insurance:b.insurance,p_policy:encryptPolicy(b.policy),p_brands:b.brands,p_sms:b.smsConsent,p_request_hash:requestHash});
    if(error)throw new Error(error.message.includes('rate limit')?'Too many booking attempts. Please contact the clinic.':error.message.includes('affiliate')?'This referral is no longer available.':'That appointment time is no longer available. Please choose another.');
    const saved=mapBooking(data[0]),notifications=await claimAndSend(db,saved,'confirmation');
    return Response.json({booking:{id:saved.id,start:saved.start,duration:saved.duration,service:saved.service,affiliateId:saved.affiliateId,name:saved.name},notifications},{status:201,headers:{'Cache-Control':'no-store'}});
  }catch(e){return fail(e);}
}
