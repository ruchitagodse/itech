"use client";
export default function ApplianceError({ reset }: { reset: () => void }) { return <section className="customer-empty" role="alert"><h2>Couldn’t load appliance information.</h2><p className="muted">Try again. Contact your administrator if the issue continues.</p><button className="button primary" onClick={reset}>Try again</button></section>; }
