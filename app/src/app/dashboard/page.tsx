'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { createFlushingStatus, checkAuth } from '@/lib/bluesky-api';
import styles from './dashboard.module.css';
import Link from 'next/link';

// List of relevant emojis for flushing situations
const EMOJIS = [
  '🚽', '🧻', '💩', '💨', '🚾', '🧼', '🪠', '🚻', '🩸', '💧', '💦', '😌', 
  '😣', '🤢', '🤮', '🥴', '😮‍💨', '😳', '😵', '🌾', '🍦', '📱', '📖', '💭',
  '1️⃣', '2️⃣', '🟡', '🟤'
];

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

export default function DashboardPage() {
  const router = useRouter();
  const { isAuthenticated, accessToken, did, handle, serializedKeyPair, dpopNonce, pdsEndpoint, clearAuth } = useAuth();
  
  const [text, setText] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState(EMOJIS[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [statusOpen, setStatusOpen] = useState(false);
  
  // Feed state
  const [entries, setEntries] = useState<FlushingEntry[]>([]);
  const [loadingFeed, setLoadingFeed] = useState(true);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [newEntryIds, setNewEntryIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Redirect to home if not authenticated
    if (!isAuthenticated) {
      router.push('/');
    } else {
      // Fetch feed when component mounts
      fetchLatestEntries();
    }
  }, [isAuthenticated, router]);
  
  // Function to fetch the latest entries
  const fetchLatestEntries = async (forceRefresh = false) => {
    try {
      setLoadingFeed(true);
      setFeedError(null);
      
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
      
      // Check for new entries
      if (entries.length > 0) {
        const currentIds = new Set(entries.map(entry => entry.id));
        const newEntries = data.entries.filter(entry => !currentIds.has(entry.id));
        
        // Mark new entries for animation
        if (newEntries.length > 0) {
          setNewEntryIds(new Set(newEntries.map(entry => entry.id)));
          
          // Clear the animation markers after animation completes
          setTimeout(() => {
            setNewEntryIds(new Set());
          }, 2000);
        }
      }
      
      setEntries(data.entries);
    } catch (err: any) {
      console.error('Error fetching feed:', err);
      setFeedError(err.message || 'Failed to load feed');
    } finally {
      setLoadingFeed(false);
    }
  };

  // Logout handler
  const handleLogout = () => {
    clearAuth();
    router.push('/');
  };

  // Toggle status update form
  const toggleStatusUpdate = () => {
    setStatusOpen(!statusOpen);
    setError(null);
    setSuccess(null);
  };
  
  // Handle emoji selection
  const handleEmojiSelect = (emoji: string) => {
    setSelectedEmoji(emoji);
  };
  
  // Submit flushing status
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!accessToken || !did || !serializedKeyPair) {
      setError('Authentication information missing');
      return;
    }
    
    if (!pdsEndpoint) {
      setError('PDS endpoint is missing. Cannot proceed without it.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      console.log('Submitting status update with DID:', did);
      console.log('Using PDS endpoint:', pdsEndpoint);
      
      // Deserialize key pair
      const keyPairData = JSON.parse(serializedKeyPair);
      const publicKey = await window.crypto.subtle.importKey(
        'jwk',
        keyPairData.publicKey,
        { name: 'ECDSA', namedCurve: 'P-256' },
        true,
        ['verify']
      );
      const privateKey = await window.crypto.subtle.importKey(
        'jwk',
        keyPairData.privateKey,
        { name: 'ECDSA', namedCurve: 'P-256' },
        true,
        ['sign']
      );
      const keyPair = { publicKey, privateKey };
      
      // First, check if auth is valid
      const isAuthValid = await checkAuth(
        accessToken,
        keyPair,
        did,
        dpopNonce || null,
        pdsEndpoint
      );
      
      if (!isAuthValid) {
        setError('Authentication check failed. Your login may have expired.');
        setIsSubmitting(false);
        return;
      }
      
      // If we're authenticated, proceed with creating the status
      console.log('Authentication verified, creating status...');
      
      const result = await createFlushingStatus(
        accessToken, 
        keyPair, 
        did, 
        text, 
        selectedEmoji,
        dpopNonce || null,
        pdsEndpoint
      );
      
      console.log('Status update result:', result);
      
      // Reset form and show success message
      setText('');
      setSuccess('Your flushing status has been updated!');
      
      // Close status form after successful submission
      setTimeout(() => {
        setStatusOpen(false);
      }, 2000);
      
      // Refresh the feed to show the new status
      setTimeout(() => {
        fetchLatestEntries(true);
      }, 1000);
    } catch (err: any) {
      console.error('Failed to update status:', err);
      setError(`Failed to update status: ${err.message || 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isAuthenticated) {
    return null; // Will redirect in useEffect
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>I&apos;m Flushing</h1>
        <div className={styles.userInfo}>
          <span>Logged in as: @{handle}</span>
          <div className={styles.actions}>
            <button 
              onClick={() => fetchLatestEntries(true)} 
              className={styles.feedButton}
            >
              Refresh Feed
            </button>
            <button onClick={handleLogout} className={styles.logoutButton}>
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Status update toggle button */}
      <button 
        className={`${styles.toggleButton} ${statusOpen ? styles.toggleButtonActive : ''}`}
        onClick={toggleStatusUpdate}
      >
        {statusOpen ? 'Close' : 'Update Your Status'} 
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M19 9L12 16L5 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {/* Collapsible status update form */}
      <div className={`${styles.statusUpdateContainer} ${statusOpen ? styles.statusUpdateOpen : ''}`}>
        <div className={styles.card}>
          {error && <div className={styles.error}>{error}</div>}
          {success && <div className={styles.success}>{success}</div>}

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.formGroup}>
              <label>Select an emoji for your status</label>
              <div className={styles.emojiGrid}>
                {EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className={`${styles.emojiButton} ${
                      emoji === selectedEmoji ? styles.selectedEmoji : ''
                    }`}
                    onClick={() => handleEmojiSelect(emoji)}
                    disabled={isSubmitting}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="status">What&apos;s your status? (optional)</label>
              <input
                type="text"
                id="status"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="What's happening in the bathroom... (optional)"
                maxLength={60}
                className={styles.input}
                disabled={isSubmitting}
              />
              <div className={styles.charCount}>
                {text.length}/60
              </div>
            </div>

            <div className={styles.preview}>
              <div className={styles.previewTitle}>Preview:</div>
              <div className={styles.previewContent}>
                <span className={styles.previewEmoji}>{selectedEmoji}</span>
                <span>{text || 'is flushing'}</span>
              </div>
            </div>

            <button
              type="submit"
              className={styles.submitButton}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Updating...' : 'Update Status'}
            </button>
          </form>
        </div>
      </div>
      
      {/* Feed Section */}
      <div className={styles.feedSection}>
        <div className={styles.feedTitle}>
          <h2>Recent Bathroom Updates</h2>
          <button 
            onClick={() => fetchLatestEntries(true)}
            disabled={loadingFeed}
          >
            {loadingFeed ? 'Loading...' : 'Refresh'}
          </button>
        </div>
        
        {feedError && <div className={styles.error}>{feedError}</div>}
        
        {loadingFeed ? (
          <div className={styles.loadingContainer}>
            <div className={styles.loader}></div>
            <span>Loading feed...</span>
          </div>
        ) : (
          <div className={styles.feedList}>
            {entries.length > 0 ? (
              entries.map((entry) => (
                <div 
                  key={entry.id} 
                  className={`${styles.feedItem} ${newEntryIds.has(entry.id) ? styles.newFeedItem : ''}`}
                >
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
                <p>No entries found. Be the first to share your status!</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}