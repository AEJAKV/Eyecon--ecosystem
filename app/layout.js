import '@fontsource-variable/bodoni-moda/opsz.css';
import '@fontsource-variable/jost';
import './globals.css';
import './site.css';
import { Provider } from '@/components/provider';
import { PreviewBar } from '@/components/ui';
import { clinic,DEMO } from '@/lib/config';
export const metadata={title:{default:'Eyecon Optometry | Personal eye care',template:'%s | Eyecon Optometry'},description:'Arrange a personal eye care appointment with Eyecon Optometry. Luxury eyewear and thoughtful care.',icons:{icon:'/icon.svg'},robots:DEMO?{index:false,follow:false}:{index:true,follow:true}};
export default function RootLayout({children}){return <html lang="en-CA" data-scroll-behavior="smooth"><body><Provider><a className="skip-link" href="#main-content">Skip to content</a><PreviewBar/>{children}</Provider></body></html>;}
