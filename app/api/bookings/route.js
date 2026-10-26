import { DEMO, documentsLink, clinic } from '@/lib/config';
import { validateBooking } from '@/lib/validation';
import { adminClient, encryptPolicy, mapBooking, sameOrigin, fail, issueGift, claimGift, issueDocumentToken, verifyTurnstile, requestHash, saveServiceOption, loadDoctorDirectory } from '@/lib/server';
import { findDoctor } from '@/lib/config';
import { isVisible, offersService } from '@/lib/schedule';
import { claimAndSend, sendBookingGiftEmail } from '@/lib/notifications';
import { giftCardPng } from '@/lib/gift-image';
import { giftNumber, giftCardPath } from '@/lib/gift';
export async function POST(request) {
  try{
    sameOrigin(request);if(DEMO)return fail(new Error('Use the browser demo booking flow.'),409);
    const raw=await request.json();if(raw.website)return fail(new Error('Unable to process this booking.'));
    await verifyTurnstile(request,raw.captcha,'booking');
    const db=adminClient();await loadDoctorDirectory(db);const b=validateBooking(raw);
    // Online bookings only with optometrists shown on the website, for a service they perform, outside their time off.
    const doc=findDoctor(b.doctor);if(!isVisible(doc)||!offersService(doc,b.service))throw new Error('Please choose another optometrist or time.');
    const {data:off}=await db.from('doctor_time_off').select('id').eq('doctor',b.doctor).lte('starts_at',b.start).gt('ends_at',b.start).limit(1);
    if(off?.length)throw new Error('That appointment time is no longer available. Please choose another.');
    const {data,error}=await db.rpc('create_booking',{p_name:b.name,p_email:b.email,p_phone:b.phone,p_doctor:b.doctor,p_start:b.start,p_service:b.service,p_affiliate:b.affiliateId,p_source:b.source,p_first_visit:b.firstVisit,p_insurance:b.insurance,p_policy:encryptPolicy(b.policy),p_brands:b.brands,p_sms:b.smsConsent,p_request_hash:requestHash(request)});
    if(error)throw new Error(error.message.includes('rate limit')?'Too many booking attempts. Please contact the clinic.':error.message.includes('affiliate')?'This referral is no longer available.':'That appointment time is no longer available. Please choose another.');
    // The "Complete your file" token goes only to this patient: back to their browser and into their confirmation email.
    // A visitor holding a released card claims it; one without a token (browser storage unavailable) is issued a card now.
    const row=await saveServiceOption(db,data[0],b.serviceOption),saved=mapBooking(raw.giftToken?await claimGift(db,row,raw.giftToken):await issueGift(db,row)),documentsToken=await issueDocumentToken(db,data[0]);
    const notifications=await claimAndSend(db,{...saved,documentsLink:documentsLink(documentsToken)},'confirmation');
    // A referral booking's gift card also goes out in its own email, with the card attached.
    if(saved.giftCard&&saved.affiliateId){const {data:a}=await db.from('affiliates').select('name,gift_code').eq('id',saved.affiliateId).maybeSingle();const affiliate={name:a?.name||'your introducer',code:a?.gift_code||null},number=giftNumber(affiliate,saved.giftCard.serial);notifications.gift=(await sendBookingGiftEmail(db,saved,affiliate,await giftCardPng({number,url:clinic.site+giftCardPath(number),expiresAt:saved.giftCard.expiresAt}))).email;}
    return Response.json({booking:{id:saved.id,reference:saved.reference,doctor:saved.doctor,start:saved.start,duration:saved.duration,service:saved.service,serviceOption:saved.serviceOption,affiliateId:saved.affiliateId,name:saved.name,giftCard:saved.giftCard,documentsToken},notifications},{status:201,headers:{'Cache-Control':'no-store'}});
  }catch(e){return fail(e);}
}
