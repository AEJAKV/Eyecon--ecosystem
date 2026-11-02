import { DEMO } from '@/lib/config';
import { adminClient, sameOrigin, fail, verifyTurnstile, requestHash } from '@/lib/server';
import { addComment } from '@/lib/blog-server';
export const dynamic='force-dynamic';
// A reader's comment on a published post (migration 016): a first name and the comment, Turnstile, a honeypot and up
// to 5 comments an hour from one address. It is shown only once staff admin approve it.
export async function POST(request){
  try{
    sameOrigin(request);if(DEMO)return fail(new Error('Use the browser demo blog.'),409);
    const raw=await request.json();
    await verifyTurnstile(request,raw.captcha,'comment');
    return Response.json(await addComment(adminClient(),raw,requestHash(request)),{headers:{'Cache-Control':'no-store'}});
  }catch(e){return fail(e,e.status||400);}
}
