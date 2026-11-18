import Shop from '@/components/shop';
import { canonicalFor,SHOP_SEO } from '@/lib/seo';
// title.absolute: the root layout's "%s | Eyecon Optometry" template does not apply to this title.
export const metadata={title:{absolute:SHOP_SEO.title},description:SHOP_SEO.description,alternates:canonicalFor('/shop')};
export default async function Page({searchParams}){const {affiliate}=await searchParams;return <Shop affiliate={affiliate}/>;}
