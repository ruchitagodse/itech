"use client";
export default function RequestsError({ reset }: { reset: () => void }) { return <section className="customer-empty" role="alert"><h2>Couldn’t load service requests</h2><p className="muted">Please try again or contact your administrator.</p><button className="button primary" onClick={reset}>Try again</button></section>; }
