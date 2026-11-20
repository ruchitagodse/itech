"use client";
import c from "@/components/admin-customers/customers.module.css";
export default function TechnicianError({ reset }: { reset: () => void }) { return <section className={c.screen} role="alert"><div className={c.panel}><div className={c.empty}><h2>Couldn’t load technician information.</h2><p>Please try again to load the latest account and assignment information.</p><button className={c.primary} onClick={reset}>Try again</button></div></div></section>; }
