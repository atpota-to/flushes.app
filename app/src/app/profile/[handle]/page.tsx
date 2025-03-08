'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import styles from './profile.module.css';
import { sanitizeText } from '@/lib/content-filter';

// Types for feed entries
interface FlushingEntry {
  id: string;
  uri: string;
  cid: string;
  did: string;
  text: string;
  emoji: string;
  created_at: string;
}

export default function ProfilePage() {
  const params = useParams();
  const handle = params.handle as string;
  
  const [entries, setEntries] = useState<FlushingEntry[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch the user's statuses when the component mounts
    fetchUserStatuses();
  }, [handle]);

  // Function to fetch the user's statuses
  const fetchUserStatuses = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Call our API endpoint to get the user's statuses
      const response = await fetch(`/api/bluesky/profile?handle=${encodeURIComponent(handle)}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch profile: ${response.status}`);
      }
      
      const data = await response.json();
      setEntries(data.entries || []);
      setTotalCount(data.count || 0);
    } catch (err: any) {
      console.error('Error fetching profile:', err);
      setError(err.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <h1 className={styles.title}>im.flushing 🧻</h1>
          <p className={styles.subtitle}>https://flushing.im 🚽</p>
          <p className={styles.description}>
            The world&apos;s first decentralized social media app for sharing when you&apos;re on the toilet. Connect with other bathroom enjoyers all over the world by posting &quot;flushes&quot;! Powered by the AT Protocol. Your status updates are saved to your PDS with the im.flushing lexicon.
          </p>
        </div>
        <div className={styles.headerActions}>
          <Link href="/" className={styles.backButton}>
            ← Back to Feed
          </Link>
        </div>
      </header>
      
      <div className={styles.profileHeader}>
        <div className={styles.profileInfo}>
          <h2 className={styles.profileTitle}>@{handle}</h2>
          <p className={styles.profileStats}>
            {totalCount} bathroom {totalCount === 1 ? 'status' : 'statuses'}
          </p>
          <a 
            href={`https://bsky.app/profile/${handle}`} 
            target="_blank" 
            rel="noopener noreferrer" 
            className={styles.viewOnBluesky}
          >
            View on Bluesky
          </a>
        </div>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {loading ? (
        <div className={styles.loadingContainer}>
          <div className={styles.loader}></div>
          <p>Loading profile...</p>
        </div>
      ) : (
        <div className={styles.feedList}>
          {entries.length > 0 ? (
            entries.map((entry) => (
              <div 
                key={entry.id} 
                className={styles.feedItem}
              >
                <div className={styles.content}>
                  <div className={styles.contentLeft}>
                    <span className={styles.emoji}>{entry.emoji}</span>
                    <span className={styles.author}>@{handle}</span>
                    <span className={styles.text}>
                      {entry.text ? 
                        (entry.text.length > 60 ? `${sanitizeText(entry.text.substring(0, 60))}...` : sanitizeText(entry.text)) : 
                        'is flushing'}
                    </span>
                  </div>
                  <span className={styles.timestamp}>
                    {new Date(entry.created_at).toLocaleString()}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className={styles.emptyState}>
              <p>No statuses found for this user.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}