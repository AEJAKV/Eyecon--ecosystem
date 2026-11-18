import Landing from '@/components/landing';
import { canonicalFor } from '@/lib/seo';
export const metadata={alternates:canonicalFor('/')};
export default function Page(){return <Landing/>;}
