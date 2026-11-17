"use client";
export default function MyAppliancesError({ reset }: { reset: () => void }) { return <section className="customer-empty" role="alert"><h2>Couldn’t load your appliances.</h2><p className="muted">Please try again or contact your administrator.</p><button className="button primary" onClick={reset}>Try again</button></section>; }
