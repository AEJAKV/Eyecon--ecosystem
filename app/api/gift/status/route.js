import { DEMO } from '@/lib/config';
import { sameOrigin, fail, adminClient, giftStatus } from '@/lib/server';
// The gift card page asks whether its card is still valid, redeemed or expired, so a used card stops looking usable.
// Anyone holding the card's full number may ask; the reply is only the state and dates, never whose card it is.
export async function POST(request) {
  try{
    sameOrigin(request);if(DEMO)return fail(new Error('Use the browser demo.'),409);
    const body=await request.json().catch(()=>({}));
    const card=await giftStatus(adminClient(),String(body.number||'').slice(0,40));
    return Response.json({card},{headers:{'Cache-Control':'no-store'}});
  }catch(e){return fail(e);}
}
