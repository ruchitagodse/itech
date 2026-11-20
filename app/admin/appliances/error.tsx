"use client";

import s from "@/components/admin-appliances/appliances.module.css";

export default function ApplianceError({ reset }: { reset: () => void }) {
  return (
    <section className={s.screen} role="alert">
      <div className={s.panel}>
        <div className={s.empty}>
          <h2>Couldn’t load appliance records.</h2>
          <p>Please try again. Appliance registrations and service plans remain intact.</p>
          <button className={s.primary} onClick={reset} style={{ marginTop: 14 }}>
            Try again
          </button>
        </div>
      </div>
    </section>
  );
}
