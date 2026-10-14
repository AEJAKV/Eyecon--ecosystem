'use client';
import { useEffect, useState } from 'react';
// A QR code for a referral link, drawn in the browser.
export default function QR({url}){const [image,setImage]=useState('');useEffect(()=>{let active=true;import('qrcode').then(m=>(m.default||m).toDataURL(url,{width:220,margin:2,color:{dark:'#202221',light:'#ffffff'},errorCorrectionLevel:'M'})).then(s=>{if(active)setImage(s);});return()=>{active=false;};},[url]);return image?<img className="qr" src={image} width="150" height="150" alt="QR code linking to this affiliate’s booking page"/>:<div className="qr" aria-label="Generating QR code"/>;}
