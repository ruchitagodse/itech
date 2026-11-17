import styles from "@/components/customer-home/home.module.css";
export default function Loading() {
  return <div className={styles.state} role="status" aria-busy="true"><h1>Getting your home ready…</h1><p>Your appliances and care details are on their way.</p><div aria-hidden="true" className={styles.skeleton} /><div aria-hidden="true" className={styles.skeletonSmall} /><div aria-hidden="true" className={styles.skeletonSmall} /></div>;
}
