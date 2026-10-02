import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { DEMO } from './config.js';
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
export function mapBooking(b) { return {id:b.id,name:b.name,email:b.email,phone:b.phone,start:b.start,duration:b.duration,service:b.service,source:b.source,affiliateId:b.affiliate_id,status:b.status,commission:Number(b.commission),payout:b.payout,paidAt:b.paid_at,firstVisit:b.first_visit,smsConsent:b.sms_consent,insurance:b.insurance,policy:decryptPolicy(b.policy_encrypted),brands:b.brands,createdAt:b.created_at}; }
export function mapAffiliate(a) { return {id:a.id,name:a.name,slug:a.slug,bio:a.bio,photo:a.photo,email:a.email,active:a.active,commissionRate:Number(a.commission_rate),commissionNote:a.commission_note}; }
export function publicAffiliate(a) { const {id,name,slug,bio,photo,active}=mapAffiliate(a);return {id,name,slug,bio,photo,active}; }
export function fail(error, status=400) { const text=String(error?.message || 'Something went wrong. Please try again.');const safe=text.includes('fetch failed')?'The booking service is temporarily unavailable. Please try again.':text;return Response.json({error:safe},{status,headers:{'Cache-Control':'no-store'}}); }
export async function audit(db, actor, action, recordId) { const {error}=await db.from('audit_logs').insert({actor_id:actor,action,record_id:String(recordId)});if(error)console.error('Audit log write failed:',error.code); }
