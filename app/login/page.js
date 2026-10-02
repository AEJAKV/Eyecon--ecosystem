import { Suspense } from 'react';
import LoginForm from '@/components/login-form';
import { Loading } from '@/components/ui';
export const metadata={title:'Workspace sign-in',robots:{index:false,follow:false}};
export default function Page(){return <Suspense fallback={<Loading/>}><LoginForm/></Suspense>;}
