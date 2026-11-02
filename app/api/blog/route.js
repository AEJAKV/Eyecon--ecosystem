import { DEMO } from '@/lib/config';
import { identity, sameOrigin, fail } from '@/lib/server';
import { canWriteBlog } from '@/lib/blog';
import { loadBlogWorkspace, createPost, savePost, uploadImage, stepPost, deletePost, moderateComment } from '@/lib/blog-server';
export const dynamic='force-dynamic';
// The workspace blog (migration 016). Affiliates, the front desk and staff admin write posts; staff admin review them.
//  GET: the signed-in person's own posts (staff admin: every post, plus readers' comments), with links that expire
//  after an hour for draft pictures.
//  POST: create, save, step (submit, revise, approve, changes, reject, unpublish), delete, comment-approve,
//  comment-delete; or a picture (multipart: file and post). lib/blog.js decides who may do what.
const refused=()=>Object.assign(new Error('Blog access is not available for this account.'),{status:403});
const noStore={headers:{'Cache-Control':'no-store'}};
export async function GET(request){
  try{
    if(DEMO)return fail(new Error('Use the browser demo workspace.'),409);
    const u=await identity(request);if(!canWriteBlog(u))throw refused();
    return Response.json(await loadBlogWorkspace(u.db,u),noStore);
  }catch(e){return fail(e,e.status||401);}
}
export async function POST(request){
  try{
    sameOrigin(request);if(DEMO)return fail(new Error('Use the browser demo workspace.'),409);
    const u=await identity(request),db=u.db;if(!canWriteBlog(u))throw refused();
    if(request.headers.get('content-type')?.includes('multipart/form-data')){
      const form=await request.formData();
      return Response.json(await uploadImage(db,u,form.get('post'),form.get('file')),noStore);
    }
    const {action,payload:p={}}=await request.json();
    if(action==='create')return Response.json({post:await createPost(db,u)},noStore);
    if(action==='save')return Response.json({post:await savePost(db,u,p.id,p.draft)},noStore);
    if(action==='step')return Response.json({post:await stepPost(db,u,p.id,String(p.step||''),{note:p.note,confirm:p.confirm===true})},noStore);
    if(action==='delete')return Response.json(await deletePost(db,u,p.id),noStore);
    if(action==='comment-approve'||action==='comment-delete')return Response.json(await moderateComment(db,u,p.id,action==='comment-approve'),noStore);
    throw new Error('Unknown action.');
  }catch(e){return fail(e,e.status||400);}
}
