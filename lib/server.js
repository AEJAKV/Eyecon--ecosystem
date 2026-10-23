import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { DEMO, documentLinkExpiry } from './config.js';
import { issueGiftCard } from './gift.js';
export function adminClient() {
  if (DEMO) throw new Error('Live services are disabled in demo mode.');
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('The clinic booking service is not configured yet.');
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false,autoRefreshToken:false} });
}
export async function identity(request) {
  const token = request.headers.get('authorization')?.replace(/^Bearer /,'');
  if (!token) throw new Error('Please sign in.');
  const db=adminClient(); const {data,error}=await db.auth.getUser(token);
  if(error || !data.user) throw new Error('Your session has expired. Please sign in again.');
  const {data:profile}=await db.from('profiles').select('role,affiliate_id').eq('id',data.user.id).single();
  if(!profile) throw new Error('Your account does not have access to this workspace.');
  if(profile.role==='affiliate') { const {data:a}=await db.from('affiliates').select('active').eq('id',profile.affiliate_id).single(); if(!a?.active) throw new Error('This affiliate account is inactive.'); }
  return {id:data.user.id,role:profile.role,affiliateId:profile.affiliate_id,db};
}
export function requireStaff(user) { if(user.role!=='staff') throw new Error('Staff access is required.'); }
export function sameOrigin(request) { const origin=request.headers.get('origin'); if(!origin || origin!==new URL(request.url).origin) throw new Error('This request must come from the Eyecon website.'); }
export function encryptPolicy(value) { if(!value)return null;const key=process.env.INSURANCE_ENCRYPTION_KEY;if(!/^[a-f\d]{64}$/i.test(key||''))throw new Error('Insurance policy storage is not configured. Please leave the policy number blank.');const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',Buffer.from(key,'hex'),iv);const encrypted=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),encrypted]).toString('base64'); }
export function decryptPolicy(value) { if(!value)return '';const key=process.env.INSURANCE_ENCRYPTION_KEY;if(!key)return 'Unavailable';try{const bytes=Buffer.from(value,'base64'),decipher=createDecipheriv('aes-256-gcm',Buffer.from(key,'hex'),bytes.subarray(0,12));decipher.setAuthTag(bytes.subarray(12,28));return Buffer.concat([decipher.update(bytes.subarray(28)),decipher.final()]).toString('utf8');}catch{return 'Unavailable';} }
// documents are the booking's booking_documents rows (staff only). Storage paths are never sent to the browser.
export function mapDocument(d) { return {id:d.id,kind:d.kind,name:d.original_name,size:d.size,mime:d.mime,uploadedAt:d.uploaded_at}; }
// The amounts behind a calculated commission (staff only; affiliates never receive these). null until completed.
const num=v=>v==null?null:Number(v);
function amounts(b) { return {grossAmount:num(b.gross_amount),discountAmount:num(b.discount_amount),operationCost:num(b.operation_cost),netAmount:num(b.net_amount),commissionRate:num(b.commission_rate)}; }
export function mapPricing(p) { return {service:p.service,retailPrice:Number(p.retail_price),operationCost:Number(p.operation_cost),updatedAt:p.updated_at}; }
export function mapBooking(b, documents=[]) { return {id:b.id,reference:b.reference||null,name:b.name,email:b.email,phone:b.phone,start:b.start,duration:b.duration,service:b.service,source:b.source,affiliateId:b.affiliate_id,status:b.status,commission:Number(b.commission),payout:b.payout,paidAt:b.paid_at,firstVisit:b.first_visit,smsConsent:b.sms_consent,insurance:b.insurance,policy:decryptPolicy(b.policy_encrypted),brands:b.brands,doctor:b.doctor||null,serviceOption:b.service_option||null,...amounts(b),residencyStatus:b.residency_status||null,documents:documents.map(mapDocument),giftCard:b.gift_serial?{serial:b.gift_serial,issuedAt:b.gift_issued_at,expiresAt:b.gift_expires_at,status:b.gift_status||'Issued'}:null,createdAt:b.created_at}; }
export function mapAffiliate(a) { return {id:a.id,name:a.name,slug:a.slug,bio:a.bio,photo:a.photo,email:a.email,active:a.active,commissionRate:Number(a.commission_rate),commissionNote:a.commission_note,code:a.gift_code||null}; }
export function publicAffiliate(a) { const {id,name,slug,bio,photo,active,code}=mapAffiliate(a);return {id,name,slug,bio,photo,active,code}; }
// Issue a gift card number to a referral booking that has just been created. The unique index on gift_serial is the
// final guard: a clash simply draws another serial. The card is a courtesy, so a failure to store it (for example
// before migration 002 has run) is logged and never loses the booking.
export async function issueGift(db, row) {
  if(!row?.affiliate_id || row.gift_serial) return row;
  for(let attempt=0;attempt<5;attempt++){
    const card=issueGiftCard();
    const {error}=await db.from('bookings').update({gift_serial:card.serial,gift_issued_at:card.issuedAt,gift_expires_at:card.expiresAt,gift_status:card.status}).eq('id',row.id).is('gift_serial',null);
    if(!error) return {...row,gift_serial:card.serial,gift_issued_at:card.issuedAt,gift_expires_at:card.expiresAt,gift_status:card.status};
    if(error.code!=='23505'){console.error('Gift card not issued:',error.code);return row;}
  }
  console.error('Gift card not issued: no unused serial found');return row;
}
// "Complete your file" upload links. The token is 32 random bytes; only its SHA-256 hash is stored, so a database
// leak does not reveal working links. A failure to issue one (for example before migration 005 has run) is logged
// and never loses the booking: the patient can bring their documents instead.
export function hashToken(token) { return createHash('sha256').update(String(token)).digest('hex'); }
export async function issueDocumentToken(db, row) {
  if(!row?.id) return null;
  const token=randomBytes(32).toString('base64url');
  const {error}=await db.from('booking_document_tokens').insert({booking_id:row.id,token_hash:hashToken(token),expires_at:documentLinkExpiry(row.start)});
  if(error){console.error('Document link not issued:',error.code);return null;}
  return token;
}
// Cloudflare Turnstile for public forms. action is the form's name ('booking' or 'lookup'), and must match.
export async function verifyTurnstile(request, token, action) {
  if(!process.env.TURNSTILE_SECRET_KEY)throw new Error('Online verification is not configured. Please contact the clinic.');
  const verify=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body:new URLSearchParams({secret:process.env.TURNSTILE_SECRET_KEY,response:String(token||'')}),signal:AbortSignal.timeout(10000)}).then(r=>r.json());
  if(!verify.success || verify.hostname!==new URL(request.url).hostname || verify.action!==action)throw new Error('Please complete the verification and try again.');
}
// The visitor's IP, hashed with a server secret, for per-IP rate limits. The IP itself is never stored.
export function requestHash(request) { return createHash('sha256').update((request.headers.get('x-forwarded-for')?.split(',')[0]||'unknown')+process.env.SUPABASE_SERVICE_ROLE_KEY).digest('hex'); }
// The optional service option (migration 008) is saved after the booking is created. It is a preference, so a
// failure to store it is logged and never loses the booking.
export async function saveServiceOption(db, row, option) {
  if(!option) return row;
  const {error}=await db.from('bookings').update({service_option:option}).eq('id',row.id);
  if(error){console.error('Service option not saved:',error.code);return row;}
  return {...row,service_option:option};
}
// Direct uploads (migration 010). An unfinished upload is a booking_document_uploads row listing the storage paths
// the patient was allowed to upload to. Discarding one removes those files and the row. A path that has become a real
// document (in booking_documents) is never removed, so a half-finished save can never lose a patient's file.
export const DOCUMENTS_BUCKET='booking-documents';
export async function discardUploads(db, uploads) {
  for(const u of uploads||[]){
    const paths=(Array.isArray(u.files)?u.files:[]).map(f=>f?.path).filter(p=>typeof p==='string');
    if(paths.length){
      const {data:kept}=await db.from('booking_documents').select('file_path').in('file_path',paths);
      const keep=new Set((kept||[]).map(d=>d.file_path)),remove=paths.filter(p=>!keep.has(p));
      if(remove.length){const {error}=await db.storage.from(DOCUMENTS_BUCKET).remove(remove);if(error)console.error('Unfinished upload files not removed:',error.message);}
    }
    await db.from('booking_document_uploads').delete().eq('id',u.id);
  }
}
// Called by the hourly /api/reminders job: removes uploads abandoned more than an hour after their go-ahead ended.
export async function cleanupUploads(db) {
  const {data,error}=await db.from('booking_document_uploads').select('id,files').lt('expires_at',new Date(Date.now()-3600000).toISOString()).limit(200);
  if(error){console.error('Unfinished uploads not checked:',error.code);return 0;}
  await discardUploads(db,data);return data.length;
}
export function fail(error, status=400) { const text=String(error?.message || 'Something went wrong. Please try again.');const safe=text.includes('fetch failed')?'The booking service is temporarily unavailable. Please try again.':text;return Response.json({error:safe},{status,headers:{'Cache-Control':'no-store'}}); }
export async function audit(db, actor, action, recordId) { const {error}=await db.from('audit_logs').insert({actor_id:actor,action,record_id:String(recordId)});if(error)console.error('Audit log write failed:',error.code); }
