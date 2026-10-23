import Landing from '@/components/landing';
import { clinic } from '@/lib/config';
import { loadPreviewAffiliate } from '@/lib/preview-data';
import { previewMetadata } from '@/lib/preview';
// The link preview (title, description and, from opengraph-image.js, the photo) names the affiliate. Only public
// fields are read. The page stays out of search results.
export async function generateMetadata({params}){const {slug}=await params;return previewMetadata(await loadPreviewAffiliate(slug),clinic.site);}
export default async function Page({params}){const {slug}=await params;return <Landing slug={slug}/>;}
