import Link from 'next/link';
import styles from './not-found.module.css';

export default function NotFound() {
  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <img src="/racoon-mascot.png" alt="Raccoon mascot" className={styles.raccoon} width="160" height="160" />
        <h1 className={styles.code}>404</h1>
        <p className={styles.msg}>Even the raccoons couldn&apos;t find this page.</p>
        <Link href="/" className={styles.link}>Back to GomiHelper</Link>
      </div>
    </main>
  );
}
