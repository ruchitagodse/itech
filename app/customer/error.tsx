"use client";
import Link from "next/link";
import { HomeIcon } from "@/components/customer-home/icons";
import styles from "@/components/customer-home/home.module.css";
export default function Error({ reset }: { reset: () => void }) {
  return <section className={styles.state} role="alert"><div className={styles.panel}><div className={styles.empty}><span className={styles.emptyIcon}><HomeIcon name="home" /></span><h1>Your home details couldn’t load.</h1><p>Please try again. If the issue continues, contact your administrator.</p><button className={styles.retry} onClick={reset}>Try again</button><Link className={styles.inlineLink} href="/customer/profile">View my profile<HomeIcon name="arrow" /></Link></div></div></section>;
}
