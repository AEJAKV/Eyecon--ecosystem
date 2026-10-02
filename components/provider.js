'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { DEMO } from '@/lib/config';
import { seedDemo, applyDemo } from '@/lib/demo';
import { browserClient } from '@/lib/supabase';
const Context=createContext(null);
export function Provider({children}){
  const [data,setData]=useState({affiliates:[],bookings:[],templates:[],slots:[],jobs:[]}),[user,setUser]=useState(null),[ready,setReady]=useState(false),[error,setError]=useState('');
  async function headers(){const {data:{session}}=await browserClient().auth.getSession();return {Authorization:'Bearer '+(session?.access_token||'')};}
  async function reload(){const response=await fetch('/api/workspace',{headers:await headers(),cache:'no-store'});const result=await response.json();if(!response.ok)throw new Error(result.error);setData(result);setUser(result.user);return result;}
  useEffect(()=>{
    if(DEMO){try{const saved=JSON.parse(localStorage.getItem('eyecon-demo-v1')||'null');setData(saved?.affiliates&&saved?.bookings?saved:seedDemo());const u=JSON.parse(sessionStorage.getItem('eyecon-demo-user')||'null');if(u&&['staff','affiliate'].includes(u.role))setUser(u);}catch{setData(seedDemo());}setReady(true);return;}
    let active=true,subscription;
    try{const client=browserClient();client.auth.getSession().then(async({data:{session}})=>{if(session)try{await reload();}catch(e){if(active)setError(e.message);}if(active)setReady(true);});subscription=client.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_OUT'){setUser(null);setData({affiliates:[],bookings:[],templates:[],slots:[]});}}).data.subscription;}catch(e){setError(e.message);setReady(true);}
    return()=>{active=false;subscription?.unsubscribe();};
  },[]);
  useEffect(()=>{if(DEMO&&ready)try{localStorage.setItem('eyecon-demo-v1',JSON.stringify(data));}catch{setError('This browser could not save demo changes. Keep this tab open or reset the demo.');}},[data,ready]);
  async function action(action,payload){
    if(DEMO){let next=applyDemo(data,action,payload,user);setData(next);return action==='booking'?{booking:next.bookings[0],notifications:{email:'demo',sms:'demo'}}:{ok:true};}
    const response=await fetch('/api/workspace',{method:'POST',headers:{...await headers(),'Content-Type':'application/json'},body:JSON.stringify({action,payload})});const result=await response.json();if(!response.ok)throw new Error(result.error);await reload();return result;
  }
  async function book(payload){if(DEMO)return action('booking',payload);const response=await fetch('/api/bookings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const result=await response.json();if(!response.ok)throw new Error(result.error);return result;}
  async function photo(file,affiliateId){if(DEMO){const result=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});const a=data.affiliates.find(a=>a.id===affiliateId);return action('profile',{...a,photo:result});}const form=new FormData();form.set('file',file);form.set('affiliateId',affiliateId);const res=await fetch('/api/workspace',{method:'POST',headers:await headers(),body:form});const result=await res.json();if(!res.ok)throw new Error(result.error);await reload();}
  function demoSignIn(role){const u={role,affiliateId:role==='affiliate'?'demo-alex':null};setUser(u);sessionStorage.setItem('eyecon-demo-user',JSON.stringify(u));}
  async function signOut(){if(DEMO)sessionStorage.removeItem('eyecon-demo-user');else await browserClient().auth.signOut();setUser(null);}
  function reset(){setData(seedDemo());sessionStorage.removeItem('eyecon-demo-user');setUser(null);}
  return <Context.Provider value={{data,user,ready,error,reload,action,book,photo,demoSignIn,signOut,reset}}>{children}</Context.Provider>;
}
export function useApp(){return useContext(Context);}
