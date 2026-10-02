'use client';
export default function ErrorPage({reset}){return <main className="container empty-page" id="main-content"><h1>We couldn’t open this page</h1><p>Please try again. Your saved records remain available.</p><button className="button" onClick={reset}>Try again</button><a className="text-link" href="/">Return to Eyecon</a></main>;}
