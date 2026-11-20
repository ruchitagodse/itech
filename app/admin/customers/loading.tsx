import s from "@/components/admin-customers/customers.module.css";
export default function LoadingCustomers() { return <section className={s.panel} role="status"><div className={s.empty}><span className={s.emptyIcon}>…</span><h2>Loading customer information…</h2><p>Getting the latest customer records and service relationships.</p></div></section>; }
