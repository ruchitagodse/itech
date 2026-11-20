import styles from "@/components/customer-home/home.module.css";

export default function LoadingServicePackages() {
  return (
    <div className={styles.state} role="status" aria-busy="true">
      <h1>Loading service packages…</h1>
      <p className={styles.intro}>Fetching care plans, fixed-rate packages, and guaranteed services.</p>
      <div aria-hidden="true" className={styles.skeleton} />
      <div aria-hidden="true" className={styles.skeletonSmall} />
      <div aria-hidden="true" className={styles.skeletonSmall} />
    </div>
  );
}
