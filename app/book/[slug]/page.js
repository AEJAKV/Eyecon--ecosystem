import Landing from '@/components/landing';
export const metadata={title:'Your personal introduction',robots:{index:false,follow:false}};
export default async function Page({params}){const {slug}=await params;return <Landing slug={slug}/>;}
