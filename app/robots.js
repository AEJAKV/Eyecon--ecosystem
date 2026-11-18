import { DEMO,clinic } from '@/lib/config';
import { robotsFor } from '@/lib/seo';
export default function robots(){return robotsFor(clinic.site,DEMO);}
