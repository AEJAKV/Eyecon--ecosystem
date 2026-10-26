'use client';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { DEMO, placeholderDoctors, setDoctorDirectory } from '@/lib/config';
import { seedDemo, applyDemo, demoLookup, demoReleaseGift, demoScanGift } from '@/lib/demo';
import { browserClient, passwordLinkType, onPasswordForm, passwordFormPath } from '@/lib/supabase';
import { clearStoredGifts } from '@/lib/gift-browser';
const Context=createContext(null);
export function Provider({children}){
  const [data,setData]=useState({affiliates:[],bookings:[],templates:[],slots:[],jobs:[]}),[user,setUser]=useState(null),[ready,setReady]=useState(false),[error,setError]=useState('');
  // The demo functions read the latest data through a ref so a card released while another update is pending is not lost.
  const latest=useRef(data);latest.current=data;
  // Optometrists (migration 010). Live: the website's list from /api/doctors, or every optometrist (hidden ones too)
  // once a workspace has loaded. Demo: this browser's demo data. setDoctorDirectory makes doctorName, findDoctor and
  // validateDoctor use the same list everywhere.
  const [publicDoctors,setPublicDoctors]=useState(null);
  const doctors=DEMO?(data.doctors||placeholderDoctors):(data.doctors?.length?data.doctors:(publicDoctors||placeholderDoctors));
  setDoctorDirectory(doctors);
  const doctorsReady=DEMO?ready:!!(publicDoctors||data.doctors?.length);
  async function headers(){const {data:{session}}=await browserClient().auth.getSession();return {Authorization:'Bearer '+(session?.access_token||'')};}
  async function reload(){const response=await fetch('/api/workspace',{headers:await headers(),cache:'no-store'});const result=await response.json();if(!response.ok)throw new Error(result.error);setData(result);setUser(result.user);return result;}
  // Demo data is saved under v5 (v2 added doctors, v3 references, v4 pricing and commission amounts, v5 doctor profiles
  // and schedules); older saved data is not loaded.
  useEffect(()=>{
    if(DEMO){try{const saved=JSON.parse(localStorage.getItem('eyecon-demo-v5')||'null');setData(saved?.affiliates&&saved?.bookings&&saved?.doctors?saved:seedDemo());const u=JSON.parse(sessionStorage.getItem('eyecon-demo-user')||'null');if(u&&['staff','affiliate'].includes(u.role))setUser(u);}catch{setData(seedDemo());}setReady(true);return;}
    let active=true,subscription;
    // A password-reset or invitation link signs the person in. Whatever page it lands on (a link sent from the Supabase
    // dashboard lands on the home page), they are taken to the form that sets their password. Read before the client
    // removes the link details from the address.
    const linkType=passwordLinkType(window.location);
    try{const client=browserClient();client.auth.getSession().then(async({data:{session}})=>{if(session&&linkType&&!onPasswordForm(window.location)){window.location.replace(passwordFormPath(linkType));return;}if(session)try{await reload();}catch(e){if(active)setError(e.message);}if(active)setReady(true);});subscription=client.auth.onAuthStateChange((event,session)=>{if(event==='PASSWORD_RECOVERY'&&!onPasswordForm(window.location)){window.location.replace(passwordFormPath('recovery'));return;}if(event==='SIGNED_OUT'){setUser(null);setData({affiliates:[],bookings:[],templates:[],slots:[]});}}).data.subscription;}catch(e){setError(e.message);setReady(true);}
    return()=>{active=false;subscription?.unsubscribe();};
  },[]);
  useEffect(()=>{if(DEMO&&ready)try{localStorage.setItem('eyecon-demo-v5',JSON.stringify(data));}catch{setError('This browser could not save demo changes. Keep this tab open or reset the demo.');}},[data,ready]);
  useEffect(()=>{if(DEMO)return;let active=true;fetch('/api/doctors').then(r=>r.ok?r.json():Promise.reject()).then(r=>{if(active)setPublicDoctors(r.doctors);}).catch(()=>{if(active)setPublicDoctors([]);});return()=>{active=false;};},[]);
  async function action(action,payload){
    if(DEMO){let next=applyDemo(data,action,payload,user);setData(next);return action==='booking'?{booking:next.bookings[0],notifications:{email:'demo',sms:'demo'}}:{ok:true};}
    const response=await fetch('/api/workspace',{method:'POST',headers:{...await headers(),'Content-Type':'application/json'},body:JSON.stringify({action,payload})});const result=await response.json();if(!response.ok)throw new Error(result.error);await reload();return result;
  }
  async function book(payload){if(DEMO)return action('booking',payload);const response=await fetch('/api/bookings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const result=await response.json();if(!response.ok)throw new Error(result.error);return result;}
  // "Already have a prescription": claim the $50 card without booking. Returns { card: { serial, issuedAt, expiresAt, name }, notifications }.
  async function claimGift(payload){if(DEMO){const next=applyDemo(data,'claim',payload,user);setData(next);const c=next.giftClaims[0];return {card:{serial:c.serial,issuedAt:c.issuedAt,expiresAt:c.expiresAt,name:c.name},notifications:{email:'demo'}};}const response=await fetch('/api/gift/claim',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const result=await response.json();if(!response.ok)throw new Error(result.error);return result;}
  // Staff scan of a gift card by its number (from the card's QR code or typed). Returns giftScanView's fields.
  async function scanGift(number){if(DEMO)return demoScanGift(data,number,user);const response=await fetch('/api/gift/scan',{method:'POST',headers:{...await headers(),'Content-Type':'application/json'},body:JSON.stringify({number})});const result=await response.json();if(!response.ok)throw new Error(result.error);return result.card;}
  // Opening an affiliate's link releases a gift card to the visitor ({ serial, releasedAt, expiresAt, token }); the 180 days start now.
  async function releaseGift(slug){if(DEMO){const {data:next,card}=demoReleaseGift(latest.current,slug);latest.current=next;setData(next);return card;}const response=await fetch('/api/gift',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({slug})});const result=await response.json();if(!response.ok)throw new Error(result.error);return result;}
  async function photo(file,affiliateId){if(DEMO){const result=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});const a=data.affiliates.find(a=>a.id===affiliateId);return action('profile',{...a,photo:result});}const form=new FormData();form.set('file',file);form.set('affiliateId',affiliateId);const res=await fetch('/api/workspace',{method:'POST',headers:await headers(),body:form});const result=await res.json();if(!res.ok)throw new Error(result.error);await reload();}
  // "Complete your file". files are [{file,kind}]. In the demo only each file's name, size and type are kept, never its contents.
  async function documentsLinkValid(token){if(DEMO){const b=data.bookings.find(b=>token&&b.documentsToken===token);return !!b&&!b.documentsUsedAt&&new Date(b.documentsExpiresAt)>new Date();}const res=await fetch('/api/documents',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token})});const result=await res.json();if(!res.ok)throw new Error(result.error);return result.valid;}
  // Live: each file goes straight to private storage with a one-time signed link (the website's host refuses requests
  // over about 4.5 MB), then the server checks the stored files and records them. onProgress(done,total) reports each file.
  async function submitDocuments({token,residencyStatus,files,onProgress}){
    if(DEMO)return action('documents',{token,residencyStatus,files:files.map(({file,kind})=>({name:file.name,size:file.size,type:file.type,kind}))});
    const post=async body=>{const res=await fetch('/api/documents',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const result=await res.json().catch(()=>({error:'The connection dropped. Please try again.'}));if(!res.ok)throw new Error(result.error);return result;};
    const plan=await post({action:'start',token,residencyStatus,files:files.map(({file,kind})=>({name:file.name,size:file.size,type:file.type,kind}))});
    const storage=browserClient().storage.from('booking-documents');
    for(const [i,{file}] of files.entries()){
      onProgress?.(i+1,files.length);
      const u=plan.uploads[i];const {error}=await storage.uploadToSignedUrl(u.path,u.token,file,{contentType:file.type});
      if(error)throw new Error(`“${file.name}” could not be uploaded. Please check your connection and try again.`);
    }
    onProgress?.(files.length,files.length);
    return post({action:'finish',token,uploadId:plan.uploadId});
  }
  // /my-booking. The demo searches this browser's demo data with the same checks and the same limited result.
  async function lookupBooking(payload){if(DEMO)return {booking:demoLookup(data,payload)};const res=await fetch('/api/lookup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const result=await res.json();if(!res.ok)throw new Error(result.error);return result;}
  function demoSignIn(role){const u={role,affiliateId:role==='affiliate'?'demo-alex':null};setUser(u);sessionStorage.setItem('eyecon-demo-user',JSON.stringify(u));}
  async function signOut(){if(DEMO)sessionStorage.removeItem('eyecon-demo-user');else await browserClient().auth.signOut();setUser(null);}
  function reset(){clearStoredGifts();setData(seedDemo());sessionStorage.removeItem('eyecon-demo-user');setUser(null);}
  // Staff admin > Doctors. Live: /api/doctors (staff only), then the workspace reloads. Demo: the same rules in lib/demo.js.
  async function doctorAction(name,payload){
    if(DEMO)return action(name,payload);
    const response=await fetch('/api/doctors',{method:'POST',headers:{...await headers(),'Content-Type':'application/json'},body:JSON.stringify({action:name,payload})});const result=await response.json();if(!response.ok)throw new Error(result.error);await reload();return result;
  }
  async function doctorPhoto(file,doctor){
    if(DEMO){const url=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});const d=doctors.find(d=>d.slug===doctor);return action('doctor',{...d,photo:url});}
    const form=new FormData();form.set('file',file);form.set('doctor',doctor);const response=await fetch('/api/doctors',{method:'POST',headers:await headers(),body:form});const result=await response.json();if(!response.ok)throw new Error(result.error);await reload();return result;
  }
  return <Context.Provider value={{data,user,ready,error,reload,action,book,releaseGift,claimGift,scanGift,photo,documentsLinkValid,submitDocuments,lookupBooking,demoSignIn,signOut,reset,doctors,doctorsReady,doctorAction,doctorPhoto}}>{children}</Context.Provider>;
}
export function useApp(){return useContext(Context);}
