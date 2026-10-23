import { DEMO } from '@/lib/config';
import { validateLookup, lookupView, needsDocumentsLink, LOOKUP_NOT_FOUND } from '@/lib/lookup';
import { emrAdapter } from '@/lib/emr';
import { adminClient, mapBooking, sameOrigin, fail, verifyTurnstile, requestHash, issueDocumentToken, loadDoctorDirectory } from '@/lib/server';
export const dynamic='force-dynamic';
// /my-booking: find a booking by its reference and the email it was made with. Turnstile, a honeypot and a limit of
// 10 attempts per IP per hour (counted in the database, like bookings) stop guessing. "Not found" and "wrong email"
// return the same error, and the response holds only lookupView's fields: never contact details, insurance,
// documents or the affiliate. If the government ID is still missing, a fresh single-use "Complete your file" token
// is issued for this patient, who has just proven the reference and email.
export async function POST(request){
  try{
    sameOrigin(request);if(DEMO)return fail(new Error('Use the browser demo lookup.'),409);
    const raw=await request.json();if(raw.website)return fail(new Error(LOOKUP_NOT_FOUND),404);
    await verifyTurnstile(request,raw.captcha,'lookup');
    const {reference,email}=validateLookup(raw),db=adminClient();
    const {data,error}=await db.rpc('lookup_booking',{p_reference:reference,p_email:email,p_request_hash:requestHash(request)});
    if(error)throw new Error(error.message.includes('rate limit')?'Too many attempts. Please try again in an hour, or call the clinic.':'Booking lookup is temporarily unavailable. Please call the clinic.');
    if(!data?.length)return fail(new Error(LOOKUP_NOT_FOUND),404);
    const row=data[0],b=mapBooking(row);await loadDoctorDirectory(db);
    const [affiliate,id]=await Promise.all([
      b.giftCard&&b.affiliateId?db.from('affiliates').select('name,gift_code').eq('id',b.affiliateId).maybeSingle():{data:null},
      db.from('booking_documents').select('id').eq('booking_id',b.id).eq('kind','government-id').limit(1)
    ]);
    // The EMR, once connected, is the source of truth for status, doctor and time. Until then it returns null.
    let emr=null;try{emr=await emrAdapter().getAppointment(b.reference);}catch(e){console.error('EMR lookup failed:',e?.message);}
    const view=lookupView(b,{affiliate:affiliate.data?{name:affiliate.data.name,code:affiliate.data.gift_code}:null,fileComplete:!!id.data?.length,emr});
    const documentsToken=needsDocumentsLink(view)?await issueDocumentToken(db,row):null;
    return Response.json({booking:{...view,...(documentsToken?{documentsToken}:{})}},{headers:{'Cache-Control':'no-store'}});
  }catch(e){return fail(e);}
}
