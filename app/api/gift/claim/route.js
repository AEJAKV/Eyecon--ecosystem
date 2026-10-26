import { DEMO, clinic } from '@/lib/config';
import { giftCardPng } from '@/lib/gift-image';
import { giftNumber, giftCardPath } from '@/lib/gift';
import { validateClaim } from '@/lib/validation';
import { adminClient, sameOrigin, fail, verifyTurnstile, requestHash, claimPrescriptionGift } from '@/lib/server';
import { sendClaimEmail } from '@/lib/notifications';
// "Already have a prescription": a visitor who came through an affiliate's link claims the $50 gift card without
// booking. Same-origin, verified with Turnstile (action 'claim'), rate limited per hashed IP, one card per email per
// affiliate. The card is emailed to them and returned to their browser; nothing goes to the affiliate.
export async function POST(request) {
  try{
    sameOrigin(request);if(DEMO)return fail(new Error('Use the browser demo.'),409);
    const raw=await request.json().catch(()=>({}));if(raw.website)return fail(new Error('Unable to process this request.'));
    await verifyTurnstile(request,raw.captcha,'claim');
    const claim=validateClaim(raw),db=adminClient();
    const card=await claimPrescriptionGift(db,claim,requestHash(request));
    const {data:a}=await db.from('affiliates').select('name,gift_code').eq('id',claim.affiliateId).maybeSingle();
    const affiliate={name:a?.name||'your introducer',code:a?.gift_code||null},number=giftNumber(affiliate,card.serial);
    const notifications=await sendClaimEmail(card,affiliate,await giftCardPng({number,url:clinic.site+giftCardPath(number),expiresAt:card.expiresAt}));
    return Response.json({card:{serial:card.serial,issuedAt:card.issuedAt,expiresAt:card.expiresAt,name:card.name},notifications},{status:201,headers:{'Cache-Control':'no-store'}});
  }catch(e){return fail(e,e.status||400);}
}
