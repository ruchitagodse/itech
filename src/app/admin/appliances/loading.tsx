import s from "@/components/admin-appliances/appliances.module.css";

export default function LoadingAppliances() {
  return (
    <section className={s.panel} role="status">
      <div className={s.empty}>
        <span className={s.emptyIcon}>…</span>
        <h2>Loading appliance inventory…</h2>
        <p>Gathering registered equipment records, installation details, and coverage plans.</p>
      </div>
    </section>
  );
}
