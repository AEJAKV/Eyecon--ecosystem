import { DEMO } from '@/lib/config';
import { clean } from '@/lib/validation';
import { adminClient, sameOrigin, fail, requestHash, releaseGift } from '@/lib/server';
// A visitor opening /book/[slug] (or the booking page with ?affiliate=) asks for their gift card. The 180 days start
// here. The reply carries the claim token, once; the website keeps it in the visitor's browser and sends it with the
// booking. Same-origin requests only, and release_gift_card limits each hashed IP to 10 an hour.
export async function POST(request) {
  try{
    sameOrigin(request);if(DEMO)return fail(new Error('Use the browser demo.'),409);
    const body=await request.json().catch(()=>({})),slug=clean(body.slug,70);
    if(!slug)return fail(new Error('This referral page is unavailable.'),404);
    const db=adminClient();
    const {data:affiliate}=await db.from('affiliates').select('id').eq('slug',slug).eq('active',true).maybeSingle();
    if(!affiliate)return fail(new Error('This referral page is unavailable.'),404);
    const card=await releaseGift(db,affiliate.id,requestHash(request));
    return Response.json(card,{status:201,headers:{'Cache-Control':'no-store'}});
  }catch(e){return fail(e,e.status||400);}
}
