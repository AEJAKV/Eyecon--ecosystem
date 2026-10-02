import 'server-only';
import { calendarFile } from './calendar.js';
import { clinic, formatDate, instructions, defaultTemplates } from './config.js';
export function renderTemplate(body,b) { const values={name:b.name,date:formatDate(b.start),address:clinic.address,phone:clinic.phone,instructions:instructions.join('\n'),gift:b.affiliateId?'Your referral includes a $50 gift card, subject to the clinic’s confirmed eligibility terms.':''};return body.replace(/\{(name|date|address|phone|instructions|gift)\}/g,(_,key)=>values[key]); }
export async function sendNotification(db,b,kind) {
  const {data:template}=await db.from('message_templates').select('*').eq('id',kind).single();
  const t=template||defaultTemplates.find(t=>t.id===kind), text=renderTemplate(t.body,b);
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
