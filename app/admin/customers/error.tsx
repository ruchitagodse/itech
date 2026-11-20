"use client";
import s from "@/components/admin-customers/customers.module.css";
export default function CustomerError({ reset }: { reset: () => void }) { return <section className={s.screen} role="alert"><div className={s.panel}><div className={s.empty}><h2>Couldn’t load customer information.</h2><p>Please try again. Your customer records have not been changed.</p><button className={s.primary} onClick={reset}>Try again</button></div></div></section>; }
