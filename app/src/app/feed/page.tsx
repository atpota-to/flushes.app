'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import styles from './feed.module.css';

// Types for our feed entries
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

export default function FeedPage() {
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
      // Add refresh parameter to bypass cache if needed
      const url = forceRefresh 
        ? '/api/bluesky/feed?refresh=true'
        : '/api/bluesky/feed';
        
      const response = await fetch(url, {
        // Prevent browser caching
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

  // Format date to a readable string
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>Flushing Feed</h1>
        <p className={styles.subtitle}>
          See what everyone is doing in the bathroom right now
        </p>
      </header>

      <div className={styles.controls}>
        <button 
          onClick={() => fetchLatestEntries(true)} 
          className={styles.refreshButton}
          disabled={loading}
        >
          {loading ? 'Loading...' : 'Refresh Feed'}
        </button>
        <Link href="/" className={styles.homeLink}>
          Go to Dashboard
        </Link>
      </div>

      {error && (
        <div className={styles.error}>
          Error: {error}
        </div>
      )}

      {loading && (
        <div className={styles.loadingContainer}>
          <div className={styles.loader}></div>
          <p>Loading latest entries...</p>
        </div>
      )}

      <div className={styles.feedList}>
        {entries.length > 0 ? (
          entries.map((entry) => (
            <div key={entry.id} className={styles.feedItem}>
              <div className={styles.feedHeader}>
                <a 
                  href={`https://bsky.app/profile/${entry.authorHandle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.authorLink}
                >
                  @{entry.authorHandle}
                </a>
                <span className={styles.timestamp}>
                  {formatDate(entry.createdAt)}
                </span>
              </div>
              <div className={styles.content}>
                <span className={styles.emoji}>{entry.emoji}</span>
                <span className={styles.text}>{entry.text}</span>
              </div>
            </div>
          ))
        ) : !loading ? (
          <div className={styles.emptyState}>
            <p>No entries found. Be the first to share your status!</p>
            <Link href="/" className={styles.createButton}>
              Create Status
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}