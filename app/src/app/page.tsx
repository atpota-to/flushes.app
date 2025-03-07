import Link from 'next/link';
import styles from './page.module.css';

export default function Home() {
  // The OAuth flow starts on the client side, so we'll handle it there
  return (
    <div className={styles.container}>
      <div className={styles.homeContainer}>
        <h1 className={styles.title}>I&apos;m Flushing</h1>
        <p className={styles.description}>
          Share your flushing status with the Bluesky community
        </p>
        <div className={styles.btnContainer}>
          <Link href="/auth/login" className={styles.loginButton}>
            Login with Bluesky
          </Link>
        </div>
      </div>
    </div>
  );
}