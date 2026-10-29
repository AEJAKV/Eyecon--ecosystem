import { DEMO } from '@/lib/config';
import { parseGiftNumber } from '@/lib/gift';
import { identity, requireClinic, sameOrigin, fail, scanGiftCard, audit } from '@/lib/server';
// Staff scan a patient's gift card (its QR code opens /gift/[number]) or type its number. Staff admin and front desk only. Returns the
// card's status and validity, the patient's name and email, and for a booking the appointment; never the phone,
// insurance, health card or amounts. Each scan is written to the audit log.
export async function POST(request) {
  try{
    sameOrigin(request);if(DEMO)return fail(new Error('Use the browser demo.'),409);
    const user=await identity(request);requireClinic(user);
    const body=await request.json().catch(()=>({})),serial=parseGiftNumber(body.number);
    if(!serial)return fail(new Error('That is not an Eyecon gift card number.'),400);
    const card=await scanGiftCard(user.db,serial);
    await audit(user.db,user.id,'gift-card-scan',serial);
    if(!card)return fail(new Error('No gift card has this number. Check it and try again.'),404);
    return Response.json({card},{headers:{'Cache-Control':'no-store'}});
  }catch(e){return fail(e,/sign in|session|access/i.test(e.message)?403:e.status||400);}
}
