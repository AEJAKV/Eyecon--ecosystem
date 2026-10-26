import GiftCardPage from '@/components/gift-card-page';
// A gift card's own page: the QR code on every issued card opens it. Anyone sees the card (its number and QR code);
// signed-in staff also see whose card it is. Kept out of search results.
export const metadata={title:'Your Eyecon gift card',robots:{index:false,follow:false}};
export default async function Page({params}){const {number}=await params;return <GiftCardPage number={decodeURIComponent(number)}/>;}
