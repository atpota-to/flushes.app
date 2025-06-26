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
        <button onClick={handleDownload} className={styles.downloadButton}>
            Download Shortcut
          </button>
          <div className={styles.helpSection}>
        <h2>Need Help?</h2>
        <p>
          Check out our <Link href="/about">About page</Link> for more information or 
          reach out on <a href="https://bsky.app/profile/flushes.app" target="_blank" rel="noopener noreferrer">Bluesky</a>.
        </p>
      </div>
      </div>
    </div>
  );
}