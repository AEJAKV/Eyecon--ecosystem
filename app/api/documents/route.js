import { DEMO, DOCUMENT_TYPES, DOCUMENT_MAX_BYTES, DOCUMENT_MAX_FILES } from '@/lib/config';
import { validateDocuments, fileSignatureOk } from '@/lib/validation';
import { adminClient, sameOrigin, fail, hashToken, audit } from '@/lib/server';
export const dynamic='force-dynamic';
// "Complete your file". The patient proves which booking they are completing with the single-use token issued with the
// booking (it reaches only their browser and confirmation email). Nothing here returns a storage path or URL.
//  - JSON {token}: is this link still usable? Answers {valid}. Lets the page say so before the patient fills it in.
//  - multipart (token, residencyStatus, file[], kind[]): validates every file, then claims the token, uploads the
//    files to the private 'booking-documents' bucket and records them. Any failure undoes the uploads and frees the
//    token again, so the patient can retry.
const USED='This link has expired or has already been used. Please contact the clinic.';
const tokenOf=value=>{const t=String(value||'');if(!/^[A-Za-z0-9_-]{43}$/.test(t))throw new Error(USED);return t;};
export async function POST(request){
  try{
    sameOrigin(request);if(DEMO)return fail(new Error('Use the browser demo form.'),409);
    const db=adminClient(),now=new Date().toISOString();
    if(!request.headers.get('content-type')?.includes('multipart/form-data')){
      const {token}=await request.json();let valid=false;
      try{const {data}=await db.from('booking_document_tokens').select('booking_id').eq('token_hash',hashToken(tokenOf(token))).is('used_at',null).gt('expires_at',now).maybeSingle();valid=!!data;}catch{}
      return Response.json({valid},{headers:{'Cache-Control':'no-store'}});
    }
    // Refuse a request bigger than the most the form can send before reading it into memory.
    if(Number(request.headers.get('content-length')||0)>DOCUMENT_MAX_FILES*DOCUMENT_MAX_BYTES+1048576)throw new Error(`Please upload at most ${DOCUMENT_MAX_FILES} files of ${DOCUMENT_MAX_BYTES/1048576} MB each.`);
    const form=await request.formData(),token=tokenOf(form.get('token'));
    const uploads=form.getAll('file'),kinds=form.getAll('kind');
    if(uploads.length>DOCUMENT_MAX_FILES)throw new Error(`Please upload at most ${DOCUMENT_MAX_FILES} files in total.`);
    if(uploads.some(f=>!f||typeof f.arrayBuffer!=='function')||kinds.length!==uploads.length)throw new Error('Please choose your files again.');
    const {residencyStatus,files}=validateDocuments({residencyStatus:String(form.get('residencyStatus')||''),files:uploads.map((f,i)=>({name:f.name,size:f.size,type:f.type,kind:String(kinds[i])}))});
    // The same signature check as the affiliate photo upload: the bytes must match the type the browser claimed.
    const bytes=await Promise.all(uploads.map(async f=>Buffer.from(await f.arrayBuffer())));
    files.forEach((f,i)=>{if(bytes[i].length!==f.size||bytes[i].length>DOCUMENT_MAX_BYTES||!fileSignatureOk(f.type,bytes[i]))throw new Error(`“${f.name}” does not look like a real ${DOCUMENT_TYPES[f.type].toUpperCase()} file.`);});
    // Claim the link. Only one request can win: the update matches only an unused, unexpired token.
    const {data:claimed,error:ce}=await db.from('booking_document_tokens').update({used_at:now}).eq('token_hash',hashToken(token)).is('used_at',null).gt('expires_at',now).select('booking_id');
    if(ce||!claimed?.length)throw new Error(USED);
    const bookingId=claimed[0].booking_id,stored=[];
    // A booking can have several links (the emailed one and any issued on /my-booking). Undo frees only this one.
    const undo=async()=>{if(stored.length)await db.storage.from('booking-documents').remove(stored);await db.from('booking_document_tokens').update({used_at:null}).eq('token_hash',hashToken(token));};
    const {data:existing}=await db.from('booking_documents').select('id').eq('booking_id',bookingId).eq('kind','government-id').limit(1);
    if(existing?.length)throw new Error('Your file is already complete. To change it, please contact the clinic.');
    try{
      const rows=[];
      for(const [i,f] of files.entries()){
        const path=bookingId+'/'+crypto.randomUUID()+'.'+DOCUMENT_TYPES[f.type];
        const {error}=await db.storage.from('booking-documents').upload(path,bytes[i],{contentType:f.type,upsert:false});
        if(error)throw new Error('Your files could not be uploaded. Please try again.');
        stored.push(path);rows.push({booking_id:bookingId,kind:f.kind,file_path:path,original_name:f.name,size:f.size,mime:f.type});
      }
      const {error:de}=await db.from('booking_documents').insert(rows);if(de)throw new Error('Your files could not be saved. Please try again.');
      const {error:be}=await db.from('bookings').update({residency_status:residencyStatus}).eq('id',bookingId);if(be){await db.from('booking_documents').delete().in('file_path',stored);throw new Error('Your file could not be saved. Please try again.');}
    }catch(e){await undo();throw e;}
    // The file is complete, so every other link for this booking closes too.
    await db.from('booking_document_tokens').update({used_at:now}).eq('booking_id',bookingId).is('used_at',null);
    await audit(db,null,'documents',bookingId);
    return Response.json({ok:true,count:files.length},{status:201,headers:{'Cache-Control':'no-store'}});
  }catch(e){return fail(e);}
}
