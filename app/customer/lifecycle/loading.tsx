import styles from "@/components/customer-home/home.module.css";

export default function LoadingLifecycle() {
  return (
    <div className={styles.state} role="status" aria-busy="true">
      <h1>Loading care & renewals…</h1>
      <p className={styles.intro}>Fetching your scheduled maintenance visits, AMC proposals, and alerts.</p>
      <div aria-hidden="true" className={styles.skeleton} />
      <div aria-hidden="true" className={styles.skeletonSmall} />
      <div aria-hidden="true" className={styles.skeletonSmall} />
    </div>
  );
}