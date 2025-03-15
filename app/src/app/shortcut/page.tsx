'use client';

import { useState } from 'react';
import Link from 'next/link';
import styles from './shortcut.module.css';

export default function ShortcutPage() {
  const [isCopied, setIsCopied] = useState(false);

  const handleDownload = () => {
    // Usually this would be a direct link to the shortcut file
    window.open('https://www.icloud.com/shortcuts/d1caee7798dc4de3bef4defa0085dd72', '_blank');
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Apple Shortcut</h1>
        <p className={styles.subtitle}>Flush faster or add an NFC sticker to your bathroom for automatic flushing</p>
      </div>

      <div className={styles.shortcutCard}>
        <div className={styles.cardContent}>
          <h2>Apple Shortcut</h2>
          <p>Add the official Flushes shortcut to your iPhone for quicker posting.</p>
          <div className={styles.featureList}>
            <div className={styles.feature}>
              <span className={styles.icon}>⚡️</span>
              <span>Quick access from home screen or action button</span>
            </div>
            <div className={styles.feature}>
              <span className={styles.icon}>🔐</span>
              <span>Securely stores your credentials on-device</span>
            </div>
            <div className={styles.feature}>
              <span className={styles.icon}>📱</span>
              <span>NFC sticker compatible</span>
            </div>
          </div>
          <button onClick={handleDownload} className={styles.downloadButton}>
            Download Shortcut
          </button>
        </div>
        <div className={styles.shortcutImage}>
          {/* Replace with actual image of your shortcut */}
          <div className={styles.placeholderImage}>
            <span>📱</span>
          </div>
        </div>
      </div>

      <div className={styles.helpSection}>
        <h2>Need Help?</h2>
        <p>
          Check out our <Link href="/about">About page</Link> for more information or 
          reach out on <a href="https://bsky.app/profile/flushes.app" target="_blank" rel="noopener noreferrer">Bluesky</a>.
        </p>
      </div>
    </div>
  );
}