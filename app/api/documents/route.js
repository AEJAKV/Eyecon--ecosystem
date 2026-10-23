import { DEMO, DOCUMENT_TYPES, DOCUMENT_UPLOAD_HOURS } from '@/lib/config';
import { validateDocuments, checkUploadedFile } from '@/lib/validation';
import { adminClient, sameOrigin, fail, hashToken, audit, discardUploads, DOCUMENTS_BUCKET } from '@/lib/server';
export const dynamic='force-dynamic';
// "Complete your file". The patient proves which booking they are completing with the single-use token issued with the
// booking (it reaches only their browser and confirmation email). Files never pass through this route: the website's
// host limits a request to about 4.5 MB, so each file goes straight from the browser to the private bucket.
// Every request is small JSON:
//  - {token}: is this link still usable? Answers {valid}. Lets the page say so before the patient fills it in.
//  - {action:'start', token, residencyStatus, files:[{name,size,type,kind}]}: checks the details and answers with one
//    signed upload link per file (each for a path this route chose). Any earlier unfinished upload for the link is
//    removed first.
//  - {action:'finish', token, uploadId}: checks every stored file (it arrived, its size and type match what was
//    declared, and its first bytes really are a PDF, JPG or PNG), then claims the token and records the documents.
//    A file that fails the check removes the whole upload, so the patient starts again; nothing half-checked is kept.
const USED='This link has expired or has already been used. Please contact the clinic.';
const AGAIN='Your upload did not finish. Please choose your files and try again.';
const tokenOf=value=>{const t=String(value||'');if(!/^[A-Za-z0-9_-]{43}$/.test(t))throw new Error(USED);return t;};
const uploadIdOf=value=>{const t=String(value||'');if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t))throw new Error(AGAIN);return t;};
const COMPLETE='Your file is already complete. To change it, please contact the clinic.';
async function openBooking(db,tokenHash,now){
  const {data}=await db.from('booking_document_tokens').select('booking_id').eq('token_hash',tokenHash).is('used_at',null).gt('expires_at',now).maybeSingle();
  return data?.booking_id||null;
}
async function hasGovernmentId(db,bookingId){
  const {data}=await db.from('booking_documents').select('id').eq('booking_id',bookingId).eq('kind','government-id').limit(1);
  return !!data?.length;
}
// The first 16 bytes of a stored file, read through a 60-second signed link, for the file-signature check.
async function firstBytes(db,path){
  const {data,error}=await db.storage.from(DOCUMENTS_BUCKET).createSignedUrl(path,60);if(error)return null;
  const res=await fetch(data.signedUrl,{headers:{Range:'bytes=0-15'},signal:AbortSignal.timeout(15000)}).catch(()=>null);
  if(!res?.ok||!res.body)return null;
  const reader=res.body.getReader(),chunks=[];let n=0;
  try{while(n<16){const {done,value}=await reader.read();if(done)break;chunks.push(value);n+=value.length;}}finally{reader.cancel().catch(()=>{});}
  return Buffer.concat(chunks.map(c=>Buffer.from(c))).subarray(0,16);
}
async function start(db,token,body,now){
  const tokenHash=hashToken(token),bookingId=await openBooking(db,tokenHash,now);
  if(!bookingId)throw new Error(USED);
  if(await hasGovernmentId(db,bookingId))throw new Error(COMPLETE);
  const {residencyStatus,files}=validateDocuments({residencyStatus:body.residencyStatus,files:body.files});
  const {data:earlier}=await db.from('booking_document_uploads').select('id,files').eq('token_hash',tokenHash);
  await discardUploads(db,earlier);
  const planned=files.map(f=>({...f,path:bookingId+'/'+crypto.randomUUID()+'.'+DOCUMENT_TYPES[f.type]}));
  const uploads=[];
  for(const f of planned){
    const {data,error}=await db.storage.from(DOCUMENTS_BUCKET).createSignedUploadUrl(f.path);
    if(error)throw new Error('Uploads are temporarily unavailable. Please try again.');
    uploads.push({path:data.path,token:data.token});
  }
  const expires=new Date(Date.now()+DOCUMENT_UPLOAD_HOURS*3600000).toISOString();
  const {data:row,error}=await db.from('booking_document_uploads').insert({booking_id:bookingId,token_hash:tokenHash,residency_status:residencyStatus,files:planned,expires_at:expires}).select('id').single();
  if(error)throw new Error('Uploads are temporarily unavailable. Please try again.');
  return Response.json({uploadId:row.id,uploads},{headers:{'Cache-Control':'no-store'}});
}
async function finish(db,token,body,now){
  const tokenHash=hashToken(token),uploadId=uploadIdOf(body.uploadId);
  const {data:upload}=await db.from('booking_document_uploads').select('*').eq('id',uploadId).eq('token_hash',tokenHash).gt('expires_at',now).maybeSingle();
  if(!upload)throw new Error(AGAIN);
  const files=Array.isArray(upload.files)?upload.files:[];
  // Check what actually reached storage before anything is recorded.
  for(const f of files){
    const {data:stored}=await db.storage.from(DOCUMENTS_BUCKET).info(f.path);
    const problem=checkUploadedFile(f,stored,stored?await firstBytes(db,f.path):null);
    if(problem){await discardUploads(db,[upload]);throw new Error(problem);}
  }
  // Claim the link. Only one request can win: the update matches only an unused, unexpired token.
  const {data:claimed,error:ce}=await db.from('booking_document_tokens').update({used_at:now}).eq('token_hash',tokenHash).is('used_at',null).gt('expires_at',now).select('booking_id');
  if(ce||!claimed?.length)throw new Error(USED);
  const bookingId=claimed[0].booking_id;
  // A booking can have several links (the emailed one and any issued on /my-booking). This frees only this one.
  const release=()=>db.from('booking_document_tokens').update({used_at:null}).eq('token_hash',tokenHash);
  if(bookingId!==upload.booking_id){await release();throw new Error(AGAIN);}
  if(await hasGovernmentId(db,bookingId)){await discardUploads(db,[upload]);throw new Error(COMPLETE);}
  const rows=files.map(f=>({booking_id:bookingId,kind:f.kind,file_path:f.path,original_name:f.name,size:f.size,mime:f.type}));
  const {error:de}=await db.from('booking_documents').insert(rows);
  if(de){await release();throw new Error('Your files could not be saved. Please try again.');}
  const {error:be}=await db.from('bookings').update({residency_status:upload.residency_status}).eq('id',bookingId);
  if(be){await db.from('booking_documents').delete().in('file_path',files.map(f=>f.path));await release();throw new Error('Your file could not be saved. Please try again.');}
  // The files are now documents; only the upload record goes. The file is complete, so every other link closes too.
  await db.from('booking_document_uploads').delete().eq('id',upload.id);
  await db.from('booking_document_tokens').update({used_at:now}).eq('booking_id',bookingId).is('used_at',null);
  await audit(db,null,'documents',bookingId);
  return Response.json({ok:true,count:files.length},{status:201,headers:{'Cache-Control':'no-store'}});
}
export async function POST(request){
  try{
    sameOrigin(request);if(DEMO)return fail(new Error('Use the browser demo form.'),409);
    if(!request.headers.get('content-type')?.includes('application/json'))throw new Error('Please refresh the page and try again.');
    const body=await request.json().catch(()=>({})),db=adminClient(),now=new Date().toISOString();
    if(body.action==='start')return await start(db,tokenOf(body.token),body,now);
    if(body.action==='finish')return await finish(db,tokenOf(body.token),body,now);
    let valid=false;
    try{valid=!!await openBooking(db,hashToken(tokenOf(body.token)),now);}catch{}
    return Response.json({valid},{headers:{'Cache-Control':'no-store'}});
  }catch(e){return fail(e);}
}
