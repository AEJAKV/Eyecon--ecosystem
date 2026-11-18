import Landing from '@/components/landing';
import { HomeSchema } from '@/components/schema';
import { canonicalFor,HOME_SEO } from '@/lib/seo';
// title.absolute: the root template's " | Eyecon Optometry" suffix is already part of the title.
export const metadata={title:{absolute:HOME_SEO.title},description:HOME_SEO.description,alternates:canonicalFor('/')};
export default function Page(){return <><HomeSchema/><Landing/></>;}
