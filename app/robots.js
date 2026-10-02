import { DEMO,clinic } from '@/lib/config';
export default function robots(){return {rules:{userAgent:'*',...(DEMO?{disallow:'/'}:{allow:'/',disallow:['/admin','/affiliate','/booking','/book/','/login','/api/']})}};}
