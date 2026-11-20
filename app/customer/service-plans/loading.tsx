import styles from "@/components/customer-home/home.module.css";

export default function LoadingServicePlans() {
  return (
    <div className={styles.state} role="status" aria-busy="true">
      <h1>Loading your service plans…</h1>
      <p className={styles.intro}>Fetching your active appliance coverage and maintenance benefits.</p>
      <div aria-hidden="true" className={styles.skeleton} />
      <div aria-hidden="true" className={styles.skeletonSmall} />
      <div aria-hidden="true" className={styles.skeletonSmall} />
    </div>
  );
}
