import styles from "@/components/customer-home/home.module.css";

export default function LoadingProfile() {
  return (
    <div className={styles.state} role="status" aria-busy="true">
      <h1>Loading your profile…</h1>
      <p className={styles.intro}>Fetching your account details, registered address, and service settings.</p>
      <div aria-hidden="true" className={styles.skeleton} />
      <div aria-hidden="true" className={styles.skeletonSmall} />
    </div>
  );
}
