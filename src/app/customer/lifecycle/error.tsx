"use client";

import Link from "next/link";
import { HomeIcon } from "@/components/customer-home/icons";
import styles from "@/components/customer-home/home.module.css";

export default function LifecycleError({ reset }: { reset: () => void }) {
  return (
    <section className={styles.state} role="alert">
      <div className={styles.panel}>
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>
            <HomeIcon name="clock" />
          </span>
          <h1>Care & renewals are currently unavailable.</h1>
          <p>Please try again in a few moments or contact customer care.</p>
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