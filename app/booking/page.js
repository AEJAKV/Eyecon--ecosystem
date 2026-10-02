import { Suspense } from 'react';
import BookingFlow from '@/components/booking-flow';
import { Loading } from '@/components/ui';
export const metadata={title:'Book your appointment',robots:{index:false,follow:false}};
export default function Page(){return <Suspense fallback={<Loading/>}><BookingFlow/></Suspense>;}
