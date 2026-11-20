import c from "@/components/admin-customers/customers.module.css";
export default function LoadingTechnicians() { return <section className={c.panel} role="status"><div className={c.empty}><h2>Loading technician information…</h2><p>Getting account details and recorded assignments.</p></div></section>; }
