"use client";
export default function ErrorPage({reset}:{reset:()=>void}) { return <section className="customer-empty" role="alert"><h2>Couldn’t load service packages</h2><p className="muted">Please try again or contact your administrator.</p><button className="button primary" onClick={reset}>Try again</button></section>; }
