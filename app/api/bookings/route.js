import { DEMO, documentsLink } from '@/lib/config';
import { validateBooking } from '@/lib/validation';
import { adminClient, encryptPolicy, mapBooking, sameOrigin, fail, issueGift, issueDocumentToken, verifyTurnstile, requestHash, saveServiceOption } from '@/lib/server';
import { claimAndSend } from '@/lib/notifications';
export async function POST(request) {
  try{
    sameOrigin(request);if(DEMO)return fail(new Error('Use the browser demo booking flow.'),409);
    const raw=await request.json();if(raw.website)return fail(new Error('Unable to process this booking.'));
    await verifyTurnstile(request,raw.captcha,'booking');
    const b=validateBooking(raw),db=adminClient();
    const {data,error}=await db.rpc('create_booking',{p_name:b.name,p_email:b.email,p_phone:b.phone,p_doctor:b.doctor,p_start:b.start,p_service:b.service,p_affiliate:b.affiliateId,p_source:b.source,p_first_visit:b.firstVisit,p_insurance:b.insurance,p_policy:encryptPolicy(b.policy),p_brands:b.brands,p_sms:b.smsConsent,p_request_hash:requestHash(request)});
    if(error)throw new Error(error.message.includes('rate limit')?'Too many booking attempts. Please contact the clinic.':error.message.includes('affiliate')?'This referral is no longer available.':'That appointment time is no longer available. Please choose another.');
    // The "Complete your file" token goes only to this patient: back to their browser and into their confirmation email.
    const saved=mapBooking(await issueGift(db,await saveServiceOption(db,data[0],b.serviceOption))),documentsToken=await issueDocumentToken(db,data[0]);
    const notifications=await claimAndSend(db,{...saved,documentsLink:documentsLink(documentsToken)},'confirmation');
    return Response.json({booking:{id:saved.id,reference:saved.reference,doctor:saved.doctor,start:saved.start,duration:saved.duration,service:saved.service,serviceOption:saved.serviceOption,affiliateId:saved.affiliateId,name:saved.name,giftCard:saved.giftCard,documentsToken},notifications},{status:201,headers:{'Cache-Control':'no-store'}});
  }catch(e){return fail(e);}
}
