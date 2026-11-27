import styles from "@/components/customer-home/home.module.css";

export default function LoadingMyAppliances() {
  return (
    <div className={styles.state} role="status" aria-busy="true">
      <h1>Loading your appliances…</h1>
      <p className={styles.intro}>Fetching your registered home appliances and coverage details.</p>
      <div aria-hidden="true" className={styles.skeleton} />
      <div aria-hidden="true" className={styles.skeletonSmall} />
      <div aria-hidden="true" className={styles.skeletonSmall} />
    </div>
  );
}
