import { notFound } from 'next/navigation';
import { BrandPage } from '@/components/shop';
import { BrandSchema } from '@/components/schema';
import { collections } from '@/lib/config';
import { canonicalFor,brandTitle,brandDescription } from '@/lib/seo';
// Every brand page is built at build time; any other slug is the site's not-found page.
export const dynamicParams=false;
export function generateStaticParams(){return collections.map(c=>({slug:c.slug}));}
const findBrand=slug=>collections.find(c=>c.slug===slug);
export async function generateMetadata({params}){const brand=findBrand((await params).slug);return brand?{title:{absolute:brandTitle(brand.name)},description:brandDescription(brand.blurb),alternates:canonicalFor('/shop/'+brand.slug)}:{};}
export default async function Page({params}){const {slug}=await params;if(!findBrand(slug))notFound();return <><BrandSchema brand={findBrand(slug)}/><BrandPage slug={slug}/></>;}
