'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';
import { useAuth } from '@/lib/auth-context';
import { containsBannedWords, sanitizeText } from '@/lib/content-filter';

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
  const router = useRouter();
  const { isAuthenticated, accessToken, did, handle, serializedKeyPair, dpopNonce, pdsEndpoint, clearAuth } = useAuth();
  
  // Status update state
  const [text, setText] = useState('is ');
  const [selectedEmoji, setSelectedEmoji] = useState('🚽');
  const [statusOpen, setStatusOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Feed state
  const [entries, setEntries] = useState<FlushingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newEntryIds, setNewEntryIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Fetch the latest entries when the component mounts
    fetchLatestEntries();
  }, []);

  // Toggle status update form
  const toggleStatusUpdate = () => {
    setStatusOpen(!statusOpen);
    setStatusError(null);
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
      setStatusError('Authentication information missing');
      return;
    }
    
    if (!pdsEndpoint) {
      setStatusError('PDS endpoint is missing. Cannot proceed without it.');
      return;
    }
    
    // Check for banned words
    if (text && containsBannedWords(text)) {
      setStatusError('Your status contains inappropriate language. Please revise it.');
      return;
    }

    setIsSubmitting(true);
    setStatusError(null);
    setSuccess(null);

    try {
      // Use import to dynamically load the bluesky-api module
      const { createFlushingStatus, checkAuth } = await import('@/lib/bluesky-api');
      
      // Deserialize keypair properly
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
        setStatusError('Authentication check failed. Your login may have expired.');
        setIsSubmitting(false);
        return;
      }
      
      // If we're authenticated, proceed with creating the status
      console.log('Authentication verified, creating status...');
      
      // Format status text to ensure it begins with "is"
      let formattedText = text.trim();
      
      // If text is empty or just "is", use default "is flushing"
      if (!formattedText || formattedText === "is") {
        formattedText = "is flushing";
      } 
      // If text doesn't start with "is", add it
      else if (!formattedText.toLowerCase().startsWith("is ")) {
        formattedText = `is ${formattedText}`;
      }
      
      const result = await createFlushingStatus(
        accessToken, 
        keyPair, 
        did, 
        formattedText, 
        selectedEmoji,
        dpopNonce || null,
        pdsEndpoint
      );
      
      console.log('Status update result:', result);
      
      // Reset form and show success message
      setText('is ');
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
      setStatusError(`Failed to update status: ${err.message || 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

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
      
      // Check for new entries
      if (entries.length > 0) {
        const currentIds = new Set(entries.map((entry: FlushingEntry) => entry.id));
        const newEntries = data.entries.filter((entry: FlushingEntry) => !currentIds.has(entry.id));
        
        // Mark new entries for animation
        if (newEntries.length > 0) {
          setNewEntryIds(new Set(newEntries.map((entry: FlushingEntry) => entry.id)));
          
          // Clear the animation markers after animation completes
          setTimeout(() => {
            setNewEntryIds(new Set());
          }, 2000);
        }
      }
      
      setEntries(data.entries);
    } catch (err: any) {
      console.error('Error fetching feed:', err);
      setError(err.message || 'Failed to load feed');
    } finally {
      setLoading(false);
    }
  };

  // Function to handle logout
  const handleLogout = () => {
    clearAuth();
  };

  // List of emojis for status selection
  const EMOJIS = [
    '🚽', '🧻', '💩', '💨', '🚾', '🧼', '🪠', '🚻', '🩸', '💧', '💦', '😌', 
    '😣', '🤢', '🤮', '🥴', '😮‍💨', '😳', '😵', '🌾', '🍦', '📱', '📖', '💭',
    '1️⃣', '2️⃣', '🟡', '🟤'
  ];

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <h1 className={styles.title}>im.flushing 🧻</h1>
          <p className={styles.subtitle}>https://flushing.im 🚽</p>
          <p className={styles.description}>
            The world&apos;s first decentralized social media app for sharing when you&apos;re on the toilet. Connect with other bathroom enjoyers all over the world by posting &quot;flushes&quot;! Powered by the AT Protocol. Your status updates are saved to your PDS with the im.flushing lexicon.<br />
            <span className={styles.creditLine}>
              Made by <a href="https://bsky.app/profile/dame.is" target="_blank" rel="noopener noreferrer">@dame.is</a>. 
              <a href="https://ko-fi.com/dameis" target="_blank" rel="noopener noreferrer" className={styles.kofiLink}> Contribute to my toilet paper fund here.</a>
            </span>
          </p>
        </div>
        <div className={styles.headerActions}>
          {isAuthenticated ? (
            <>
              <Link href={`/profile/${handle}`} className={styles.userInfo}>@{handle}</Link>
              <button onClick={handleLogout} className={styles.logoutButton}>
                Logout
              </button>
            </>
          ) : (
            <Link href="/auth/login" className={styles.loginButton}>
              Login with Bluesky
            </Link>
          )}
        </div>
      </header>

      {/* Status update section - only visible when logged in */}
      {isAuthenticated && (
        <>
          {/* Status update toggle button */}
          <button 
            className={`${styles.toggleButton} ${statusOpen ? styles.toggleButtonActive : ''}`}
            onClick={toggleStatusUpdate}
          >
            {statusOpen ? 'Close' : 'Update your status'} 
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M19 9L12 16L5 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          {/* Collapsible status update form */}
          <div className={`${styles.statusUpdateContainer} ${statusOpen ? styles.statusUpdateOpen : ''}`}>
            <div className={styles.card}>
              {statusError && <div className={styles.error}>{statusError}</div>}
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
                  <div className={styles.inputWrapper}>
                    <span className={styles.inputPrefix}>is </span>
                    <input
                      type="text"
                      id="status"
                      value={text.startsWith("is ") ? text.substring(3) : text}
                      onChange={(e) => setText(`is ${e.target.value}`)}
                      placeholder="flushing"
                      maxLength={57} /* 60 - 3 for "is " */
                      className={styles.inputWithPrefix}
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className={styles.charCount}>
                    {text.length}/60
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
        </>
      )}

      {/* Feed Section */}
      <div className={styles.feedSection}>
        <div className={styles.feedHeader}>
          <div className={styles.feedHeaderLeft}>
            <h2>Recent flushes</h2>
            <p className={styles.feedSubheader}>Click on a username to see their custom flushing profile.</p>
          </div>
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
                <div 
                  key={entry.id} 
                  className={`${styles.feedItem} ${newEntryIds.has(entry.id) ? styles.newFeedItem : ''}`}
                >
                  <div className={styles.content}>
                    <div className={styles.contentLeft}>
                      <span className={styles.emoji}>{entry.emoji}</span>
                      <Link 
                        href={`/profile/${entry.authorHandle}`}
                        className={styles.authorLink}
                      >
                        @{entry.authorHandle}
                      </Link>
                      <span className={styles.text}>
                        {entry.text ? (
                          entry.authorHandle && entry.authorHandle.endsWith('.is') ? 
                            // For handles ending with .is, remove the "is" prefix if it exists
                            (sanitizeText(entry.text).toLowerCase().startsWith('is ') ? 
                              (entry.text.length > 63 ? `${sanitizeText(entry.text.substring(3, 63))}...` : sanitizeText(entry.text.substring(3))) : 
                              (entry.text.length > 60 ? `${sanitizeText(entry.text.substring(0, 60))}...` : sanitizeText(entry.text))
                            ) :
                            // For regular handles, display normal text
                            (entry.text.length > 60 ? `${sanitizeText(entry.text.substring(0, 60))}...` : sanitizeText(entry.text))
                        ) : (
                          entry.authorHandle && entry.authorHandle.endsWith('.is') ? 
                            'flushing' : 'is flushing'
                        )}
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