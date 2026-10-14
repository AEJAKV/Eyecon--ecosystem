'use client';
import { useEffect, useState } from 'react';
import { useApp } from './provider';
import { Header, Footer, Loading } from './ui';
import DocumentsForm from './documents-form';

// /documents#t=TOKEN, from the confirmation email. The token sits in the URL fragment, which browsers never send to
// the server, so it stays out of server logs; the page reads it here and sends it only with the form.
export default function DocumentsPage() {
  const { ready } = useApp();
  const [token, setToken] = useState(null);
  useEffect(() => { setToken(new URLSearchParams(window.location.hash.slice(1)).get('t') || ''); }, []);
  if (!ready || token === null) return <Loading />;
  return <>
    <Header />
    <main className="container documents-page" id="main-content">
      <p className="eyebrow">BEFORE YOUR VISIT</p>
      <h1>Complete your file</h1>
      <DocumentsForm token={token} />
    </main>
    <Footer />
  </>;
}
