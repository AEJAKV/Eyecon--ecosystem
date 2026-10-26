import 'server-only';
import { calendarFile } from './calendar.js';
import { clinic, formatDate, instructions, defaultTemplates, doctorName, GIFT_CARD_DAYS } from './config.js';
import { giftNumber, giftCardPath } from './gift.js';
// {gift} carries the card number and expiry once a card has been issued to the booking. The GIFT_CARD_DAYS (30) run
// from the day the card is issued, which for a booking is the day they booked.
export function giftText(b,affiliate) { if(!b.affiliateId)return '';const terms='Terms: '+clinic.site+'/gift-card-terms';return b.giftCard?`Your referral includes a $50 gift card. Card number ${giftNumber(affiliate,b.giftCard.serial)}, valid until ${formatDate(b.giftCard.expiresAt,{dateStyle:'long',timeStyle:undefined})}. The card is valid for ${GIFT_CARD_DAYS} days from today. Show your card (QR code) at your visit: ${clinic.site}${giftCardPath(giftNumber(affiliate,b.giftCard.serial))} ${terms}`:`Your referral includes a $50 gift card, valid for ${GIFT_CARD_DAYS} days from the day it is issued. ${terms}`; }
// {doctor} is the optometrist the appointment is with, for example "Dr. First Last".
// {documents_link} is the single-use "Complete your file" link. Only the raw token can build it and the server keeps
// just its hash, so the link exists only in the confirmation sent at booking; any later message falls back to text.
export function renderTemplate(body,b,affiliate) { const values={name:b.name,doctor:doctorName(b.doctor)||'your optometrist',documents_link:b.documentsLink||'please bring your documents to your visit.',reference:b.reference||'',lookup_link:clinic.site+'/my-booking',date:formatDate(b.start),address:clinic.address,phone:clinic.phone,instructions:instructions.join('\n'),gift:giftText(b,affiliate)};return body.replace(/\{(name|doctor|documents_link|reference|lookup_link|date|address|phone|instructions|gift)\}/g,(_,key)=>values[key]); }
export async function sendNotification(db,b,kind) {
  const {data:template}=await db.from('message_templates').select('*').eq('id',kind).single();
  // The affiliate's name and code are needed for the gift card number.
  let affiliate=null;if(b.affiliateId&&b.giftCard){const {data:a}=await db.from('affiliates').select('*').eq('id',b.affiliateId).maybeSingle();if(a)affiliate={name:a.name,code:a.gift_code||null};}
  const t=template||defaultTemplates.find(t=>t.id===kind), text=renderTemplate(t.body,b,affiliate);
  const status={email:'not-configured',sms:b.smsConsent?'not-configured':'not-consented'};
  if(process.env.RESEND_API_KEY && process.env.RESEND_FROM){const res=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+process.env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':b.id+'-'+kind},body:JSON.stringify({from:process.env.RESEND_FROM,to:[b.email],subject:t.subject,text,...(kind==='confirmation'?{attachments:[{filename:'eyecon-appointment.ics',content:Buffer.from(calendarFile(b)).toString('base64')}]}:{})}),signal:AbortSignal.timeout(12000)});status.email=res.ok?'sent':'failed';}
  if(b.smsConsent && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER){const res=await fetch('https://api.twilio.com/2010-04-01/Accounts/'+process.env.TWILIO_ACCOUNT_SID+'/Messages.json',{method:'POST',headers:{Authorization:'Basic '+Buffer.from(process.env.TWILIO_ACCOUNT_SID+':'+process.env.TWILIO_AUTH_TOKEN).toString('base64'),'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({From:process.env.TWILIO_FROM_NUMBER,To:b.phone,Body:text}),signal:AbortSignal.timeout(12000)});status.sms=res.ok?'sent':'failed';}
  return status;
}
export async function claimAndSend(db,b,kind) {
  const {error}=await db.from('notification_jobs').insert({booking_id:b.id,kind,status:'processing'});
  if(error?.code==='23505')return {skipped:true};if(error){console.error('Notification job could not be recorded:',error.code);return {email:'failed',sms:'failed',reviewRequired:true};}
  try{const result=await sendNotification(db,b,kind);await db.from('notification_jobs').update({status:'finished',result}).eq('booking_id',b.id).eq('kind',kind);return result;}catch{await db.from('notification_jobs').update({status:'failed',result:{error:'Delivery failed; staff review required'}}).eq('booking_id',b.id).eq('kind',kind);return {email:'failed',sms:'failed'};}
}
// "Already have a prescription": the gift card emailed to a visitor who claimed it without booking. claim is
// claimPrescriptionGift's result; affiliate is { name, code } for the card number. One email per claim (the claim id is
// the idempotency key). Returns { email: 'sent' | 'failed' | 'not-configured' }.
export function claimEmailText(claim,affiliate) {
  const first=claim.name.split(' ')[0],until=formatDate(claim.expiresAt,{dateStyle:'long',timeStyle:undefined});
  return `Hi ${first},\n\nYour $50 Eyecon gift card is ready, courtesy of ${affiliate.name}.\n\nCard number: ${giftNumber(affiliate,claim.serial)}\nValid until: ${until}\nYour card (QR code): ${clinic.site}${giftCardPath(giftNumber(affiliate,claim.serial))}\n\nShow the card at the clinic with your prescription and we will apply it to your eyewear.${clinic.address?`\n\nEyecon Optometry, ${clinic.address}`:''}${clinic.phone?`\nQuestions? Call ${clinic.phone}.`:''}\n\nTerms: ${clinic.site}/gift-card-terms`;
}
export async function sendClaimEmail(claim,affiliate) {
  if(!process.env.RESEND_API_KEY||!process.env.RESEND_FROM)return {email:'not-configured'};
  try{
    const res=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+process.env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':'gift-claim-'+claim.id},body:JSON.stringify({from:process.env.RESEND_FROM,to:[claim.email],subject:'Your $50 Eyecon gift card',text:claimEmailText(claim,affiliate)}),signal:AbortSignal.timeout(12000)});
    return {email:res.ok?'sent':'failed'};
  }catch{return {email:'failed'};}
}
