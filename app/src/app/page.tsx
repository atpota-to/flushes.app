'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import styles from './page.module.css';
import { useAuth } from '@/lib/auth-context';

// Types for feed entries
interface FlushingEntry {
  id: string;
  uri: string;
  cid: string;
  authorDid: string;
  authorHandle: string;
  text: string;
  emoji: string;
  createdAt: string;
}

export default function Home() {
  const { isAuthenticated } = useAuth();
  const [entries, setEntries] = useState<FlushingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch the latest entries when the component mounts
    fetchLatestEntries();
  }, []);

  // Function to fetch the latest entries
  const fetchLatestEntries = async (forceRefresh = false) => {
    try {
      setLoading(true);
      setError(null);
      
      // Call our API endpoint to get the latest entries
      const url = forceRefresh 
        ? '/api/bluesky/feed?refresh=true'
        : '/api/bluesky/feed';
        
      const response = await fetch(url, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch feed: ${response.status}`);
      }
      
      const data = await response.json();
      setEntries(data.entries);
    } catch (err: any) {
      console.error('Error fetching feed:', err);
      setError(err.message || 'Failed to load feed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <h1 className={styles.title}>I&apos;m Flushing</h1>
          <p className={styles.description}>
            Share your bathroom status with the Bluesky community
          </p>
        </div>
        <div className={styles.headerActions}>
          {isAuthenticated ? (
            <Link href="/dashboard" className={styles.loginButton}>
              Go to Dashboard
            </Link>
          ) : (
            <Link href="/auth/login" className={styles.loginButton}>
              Login with Bluesky
            </Link>
          )}
        </div>
      </header>

      <div className={styles.feedSection}>
        <div className={styles.feedHeader}>
          <h2>Recent Bathroom Updates</h2>
          <button 
            onClick={() => fetchLatestEntries(true)}
            className={styles.refreshButton}
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        {loading ? (
          <div className={styles.loadingContainer}>
            <div className={styles.loader}></div>
            <p>Loading latest entries...</p>
          </div>
        ) : (
          <div className={styles.feedList}>
            {entries.length > 0 ? (
              entries.map((entry) => (
                <div key={entry.id} className={styles.feedItem}>
                  <div className={styles.content}>
                    <div className={styles.contentLeft}>
                      <span className={styles.emoji}>{entry.emoji}</span>
                      <a 
                        href={`https://bsky.app/profile/${entry.authorHandle}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.authorLink}
                      >
                        @{entry.authorHandle}
                      </a>
                      <span className={styles.text}>
                        {entry.text ? 
                          (entry.text.length > 60 ? `${entry.text.substring(0, 60)}...` : entry.text) : 
                          'is flushing'}
                      </span>
                    </div>
                    <span className={styles.timestamp}>
                      {new Date(entry.createdAt).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className={styles.emptyState}>
                <p>No entries found. Login and be the first to share your status!</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}