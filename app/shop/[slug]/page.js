import { notFound } from 'next/navigation';
import { BrandPage } from '@/components/shop';
import { collections } from '@/lib/config';
// Every brand page is built at build time; any other slug is the site's not-found page.
export const dynamicParams=false;
export function generateStaticParams(){return collections.map(c=>({slug:c.slug}));}
const findBrand=slug=>collections.find(c=>c.slug===slug);
export async function generateMetadata({params}){const brand=findBrand((await params).slug);return brand?{title:{absolute:`${brand.name} · Shop Frames · Eyecon Optometry`},description:brand.blurb}:{};}
export default async function Page({params}){const {slug}=await params;if(!findBrand(slug))notFound();return <BrandPage slug={slug}/>;}
