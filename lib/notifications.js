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
export function renderTemplate(body,b,affiliate) { const values={name:b.name,doctor:doctorName(b.doctor)||'your optometrist',documents_link:b.documentsLink||'please bring your documents to your visit.',reference:b.reference||'',lookup_link:clinic.site+'/my-booking',date:formatDate(b.start),address:clinic.address,phone:clinic.phone,instructions:instructions.join('\n'),gift:giftText(b,affiliate)};return body.replace(/\{(name|doctor|documents_link|reference|lookup_link|date|address|phone|instructions|gift)\}/g,(_,key)=>values[key]).replace(/\b([ap])\.m\.\./g,'$1.m.'); }
export async function sendNotification(db,b,kind,extra={}) {
  const {data:template}=await db.from('message_templates').select('*').eq('id',kind).single();
  // The affiliate's name and code are needed for the gift card number.
  let affiliate=null;if(b.affiliateId&&b.giftCard){const {data:a}=await db.from('affiliates').select('*').eq('id',b.affiliateId).maybeSingle();if(a)affiliate={name:a.name,code:a.gift_code||null};}
  const t=template||defaultTemplates.find(t=>t.id===kind), text=renderTemplate(t.body,b,affiliate);
  const status={email:'not-configured',sms:b.smsConsent?'not-configured':'not-consented'};
  if(process.env.RESEND_API_KEY && process.env.RESEND_FROM){const res=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+process.env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':b.id+'-'+kind},body:JSON.stringify({from:process.env.RESEND_FROM,to:[b.email],subject:t.subject,text,...(kind==='confirmation'?{html:confirmationHtml(t.body,b,affiliate),attachments:[{filename:'eyecon-appointment.ics',content:Buffer.from(calendarFile(b)).toString('base64')},...(extra.giftPng&&affiliate&&b.giftCard?[{filename:'eyecon-gift-card-'+giftNumber(affiliate,b.giftCard.serial)+'.png',content:Buffer.from(extra.giftPng).toString('base64')}]:[])]}:{})}),signal:AbortSignal.timeout(12000)});status.email=res.ok?'sent':'failed';}
  if(b.smsConsent && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER){const res=await fetch('https://api.twilio.com/2010-04-01/Accounts/'+process.env.TWILIO_ACCOUNT_SID+'/Messages.json',{method:'POST',headers:{Authorization:'Basic '+Buffer.from(process.env.TWILIO_ACCOUNT_SID+':'+process.env.TWILIO_AUTH_TOKEN).toString('base64'),'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({From:process.env.TWILIO_FROM_NUMBER,To:b.phone,Body:text}),signal:AbortSignal.timeout(12000)});status.sms=res.ok?'sent':'failed';}
  return status;
}
// extra.giftPng: the gift card image, attached to a referral booking's confirmation.
export async function claimAndSend(db,b,kind,extra={}) {
  const {error}=await db.from('notification_jobs').insert({booking_id:b.id,kind,status:'processing'});
  if(error?.code==='23505')return {skipped:true};if(error){console.error('Notification job could not be recorded:',error.code);return {email:'failed',sms:'failed',reviewRequired:true};}
  try{const result=await sendNotification(db,b,kind,extra);await db.from('notification_jobs').update({status:'finished',result}).eq('booking_id',b.id).eq('kind',kind);return result;}catch{await db.from('notification_jobs').update({status:'failed',result:{error:'Delivery failed; staff review required'}}).eq('booking_id',b.id).eq('kind',kind);return {email:'failed',sms:'failed'};}
}
// "Already have a prescription": the gift card emailed to a visitor who claimed it without booking. claim is
// claimPrescriptionGift's result; affiliate is { name, code } for the card number. One email per claim (the claim id is
// the idempotency key). Returns { email: 'sent' | 'failed' | 'not-configured' }.
export function claimEmailText(claim,affiliate) {
  const first=claim.name.split(' ')[0],until=formatDate(claim.expiresAt,{dateStyle:'long',timeStyle:undefined});
  return `Hi ${first},\n\nYour $50 Eyecon gift card is ready, courtesy of ${affiliate.name}.\n\nCard number: ${giftNumber(affiliate,claim.serial)}\nValid until: ${until}\nYour card (QR code): ${clinic.site}${giftCardPath(giftNumber(affiliate,claim.serial))}\n\nShow the card at the clinic with your prescription and we will apply it to your eyewear.${clinic.address?`\n\nEyecon Optometry, ${clinic.address}`:''}${clinic.phone?`\nQuestions? Call ${clinic.phone}.`:''}\n\nTerms: ${clinic.site}/gift-card-terms`;
}
// The gift card email, sent on its own after a referral booking and after a prescription claim: the card shown in the
// email (hosted image), the same card attached as a PNG to save, an "Open my gift card" button and a text version.
// card: { name, email, number, expiresAt }; affiliateName; start (the appointment, for a booking) or null.
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// One HTML layout for Eyecon emails: the wordmark line, a heading, then the rows given.
export function emailShell(title,rows) {
  return `<!doctype html><html><body style="margin:0;background:#f6f5f2;font-family:Helvetica,Arial,sans-serif;color:#14181d">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f5f2"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #dcdbd6">
<tr><td style="padding:28px 28px 8px;font-size:12px;letter-spacing:3px;color:#7a6230">EYECON OPTOMETRY</td></tr>
<tr><td style="padding:0 28px 4px;font-family:Georgia,serif;font-size:28px;line-height:1.25">${esc(title)}</td></tr>
${rows}
<tr><td style="padding:8px 28px 28px"></td></tr>
</table></td></tr></table></body></html>`;
}
const row=(html,style='')=>`<tr><td style="padding:12px 28px 0;font-size:16px;line-height:1.6;${style}">${html}</td></tr>`;
// The gift card inside an email: the card image (hosted, /api/gift/image), its number and validity, and a button to
// its page. The same card is attached as a PNG by the sender.
export function giftBlock({number,expiresAt}) {
  const page=clinic.site+giftCardPath(number),image=clinic.site+'/api/gift/image?number='+encodeURIComponent(number),until=formatDate(expiresAt,{dateStyle:'long',timeStyle:undefined});
  return `<tr><td style="padding:20px 28px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f1e4;border:1px solid #d8c9a6"><tr><td align="center" style="padding:20px 16px">
<div style="font-family:Georgia,serif;font-size:22px;padding-bottom:12px">Your $50 gift card</div>
<img src="${esc(image)}" width="260" alt="Eyecon $50 gift card ${esc(number)}" style="display:block;width:260px;max-width:100%;height:auto;border:0">
<div style="padding-top:10px;font-family:'Courier New',monospace;font-size:19px;letter-spacing:3px;color:#7a6230">${esc(number)}</div>
<div style="padding-top:4px;font-size:14px;color:#5b6067">Valid until ${esc(until)}. Save the attached card to your phone and show it at the clinic.</div>
<div style="padding-top:16px"><a href="${esc(page)}" style="display:inline-block;background:#14181d;color:#ffffff;text-decoration:none;padding:13px 26px;font-size:15px">Open my gift card</a></div>
</td></tr></table></td></tr>`;
}
// The prescription claim's email: no appointment, just the card.
export function giftEmailContent({name,number,expiresAt,affiliateName}) {
  const first=String(name||'').split(' ')[0]||'there',until=formatDate(expiresAt,{dateStyle:'long',timeStyle:undefined}),page=clinic.site+giftCardPath(number),terms=clinic.site+'/gift-card-terms';
  const subject='Your $50 Eyecon gift card';
  const text=`Hi ${first},\n\nYour $50 Eyecon gift card is ready, courtesy of ${affiliateName}.\n\nCard number: ${number}\nValid until: ${until}\n\nSave the attached card to your phone, or open it here: ${page}\nBring it with your prescription when you visit.${clinic.address?`\n\nEyecon Optometry, ${clinic.address}`:''}${clinic.phone?`\nQuestions? Call ${clinic.phone}.`:''}\n\nTerms: ${terms}`;
  const html=emailShell('Your $50 gift card is ready',row(`Hi ${esc(first)}, here is your gift card, courtesy of ${esc(affiliateName)}. Bring it with your prescription when you visit.`)+giftBlock({number,expiresAt})+row(`Each card can be used once.${clinic.address?` Eyecon Optometry, ${esc(clinic.address)}.`:''}${clinic.phone?` Questions? Call ${esc(clinic.phone)}.`:''} <a href="${esc(terms)}" style="color:#7a6230">Terms</a>`,'font-size:13px;color:#5b6067'));
  return {subject,text,html};
}
// The booking confirmation as HTML: the template's paragraphs (links clickable), with the gift card block where {gift}
// sits in the template when the booking has a card. The text version is renderTemplate's.
export function confirmationHtml(body,b,affiliate) {
  const GIFT='\u0000gift\u0000',withCard=!!(b.giftCard&&affiliate);
  const text=renderTemplate(body.replace('{gift}',withCard?GIFT:'{gift}'),b,affiliate);
  const link=t=>esc(t).replace(/https?:\/\/[^\s<]+/g,u=>`<a href="${u}" style="color:#7a6230">${u}</a>`).replace(/\n/g,'<br>');
  const rows=text.split(/\n{2,}/).map(p=>p.trim()).filter(Boolean).map(p=>p.includes(GIFT)?giftBlock({number:giftNumber(affiliate,b.giftCard.serial),expiresAt:b.giftCard.expiresAt}):row(link(p))).join('\n');
  return emailShell('Your appointment is booked',rows);
}
// Sends it through Resend with the PNG attached when there is one. key makes a retry send it once only.
export async function sendGiftEmail({to,key,content,png,number}) {
  if(!process.env.RESEND_API_KEY||!process.env.RESEND_FROM)return {email:'not-configured'};
  try{
    const res=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+process.env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':key},body:JSON.stringify({from:process.env.RESEND_FROM,to:[to],subject:content.subject,text:content.text,html:content.html,...(png?{attachments:[{filename:'eyecon-gift-card-'+number+'.png',content:Buffer.from(png).toString('base64')}]}:{})}),signal:AbortSignal.timeout(12000)});
    return {email:res.ok?'sent':'failed'};
  }catch{return {email:'failed'};}
}
// A prescription claim's card (claim is claimPrescriptionGift's result; affiliate is { name, code }).
export async function sendClaimEmail(claim,affiliate,png=null) {
  const number=giftNumber(affiliate,claim.serial);
  return sendGiftEmail({to:claim.email,key:'gift-claim-'+claim.id,number,png,content:giftEmailContent({name:claim.name,number,expiresAt:claim.expiresAt,affiliateName:affiliate.name})});
}

