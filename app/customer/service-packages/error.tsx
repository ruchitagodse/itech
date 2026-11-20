"use client";

import Link from "next/link";
import { HomeIcon } from "@/components/customer-home/icons";
import styles from "@/components/customer-home/home.module.css";

export default function ServicePackagesError({ reset }: { reset: () => void }) {
  return (
    <section className={styles.state} role="alert">
      <div className={styles.panel}>
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>
            <HomeIcon name="wrench" />
          </span>
          <h1>Couldn’t load service packages.</h1>
          <p>Please try again. If the issue continues, contact customer support.</p>
          <button className={styles.retry} onClick={reset}>
            Try again
          </button>
          <Link className={styles.inlineLink} href="/customer">
            Back to home
            <HomeIcon name="arrow" />
          </Link>
        </div>
      </div>
    </section>
  );
}
