import Shop from '@/components/shop';
// title.absolute: the root layout's "%s | Eyecon Optometry" template does not apply to this title.
export const metadata={title:{absolute:'Shop Frames · Eyecon Optometry'},description:'Featured frames and the eyewear houses Eyecon Optometry carries, from Cartier to LINDBERG. Reserve any frame to try at your visit.'};
export default async function Page({searchParams}){const {affiliate}=await searchParams;return <Shop affiliate={affiliate}/>;}
