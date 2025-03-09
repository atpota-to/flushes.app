'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';
import { useAuth } from '@/lib/auth-context';
import { containsBannedWords, sanitizeText, isAllowedEmoji } from '@/lib/content-filter';
import { formatRelativeTime } from '@/lib/time-utils';

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
    fetchLatestEntries(true); // Force refresh on initial load
    
    // Removed auto-refresh to avoid excessive API calls
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
  
  // Check rate limit - 2 posts per 30 minutes, except for the plumber account
  const checkRateLimit = (): boolean => {
    // Exempt the plumber account from rate limiting
    if (did === 'did:plc:fouf3svmcxzn6bpiw3lgwz22') {
      console.log('Plumber account detected - bypassing rate limits');
      return true; // Always return true (under limit) for the plumber account
    }
    
    const now = Date.now();
    const thirtyMinutesAgo = now - 30 * 60 * 1000; // 30 minutes in milliseconds
    
    // Filter entries to get only the user's entries from the last 30 minutes
    const userRecentEntries = entries.filter(entry => 
      entry.authorDid === did && 
      new Date(entry.createdAt).getTime() > thirtyMinutesAgo
    );
    
    // Return true if under limit, false if over limit
    return userRecentEntries.length < 2;
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
      setStatusError('Uh oh, looks like you have a potty mouth. Try flushing again, but go a bit easier on the language please... this is a semi-family-friendly restroom');
      return;
    }
    
    // Check rate limit - 2 posts per 30 minutes (except for the plumber account)
    if (!checkRateLimit()) {
      setStatusError("Trying to make more than 2 flushes in 30 minutes?? Might be time to get the plunger. 🪠 Regular users are limited to 2 flushes per 30 minutes.");
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
      
      // Refresh the feed after a delay to get the newly created entry
      setTimeout(() => {
        console.log('Refreshing feed to show new entry...');
        fetchLatestEntries(true);
      }, 2500);
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
      
      // Add a timestamp to ensure we bypass browser caching
      const timestamp = Date.now();
      
      // Use our simple API endpoint for reliability
      // Add refresh=true when forcing a refresh to ensure we get fresh data
      const url = forceRefresh 
        ? `/api/bluesky/feed-simple?refresh=true&_t=${timestamp}`
        : `/api/bluesky/feed-simple?_t=${timestamp}`;
        
      console.log(`Fetching feed from ${url} at ${new Date().toISOString()}`);
      
      const response = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch feed: ${response.status}`);
      }
      
      const data = await response.json();
      console.log(`Received ${data.entries?.length || 0} entries from API`);
      
      // Debug: Log the most recent entries we received
      if (data.entries && data.entries.length > 0) {
        console.log('Latest entries from API:');
        for (let i = 0; i < Math.min(3, data.entries.length); i++) {
          const entry = data.entries[i];
          console.log(`  ${i+1}. ID: ${entry.id}, Handle: @${entry.authorHandle}, Text: "${entry.text.substring(0, 20)}..."`);
        }
      }
      
      // Check for new entries
      if (entries.length > 0) {
        const currentIds = new Set(entries.map((entry: FlushingEntry) => entry.id));
        const newEntries = data.entries.filter((entry: FlushingEntry) => !currentIds.has(entry.id));
        
        // Log new entries
        if (newEntries.length > 0) {
          console.log(`Found ${newEntries.length} new entries`);
          
          // Mark new entries for animation
          setNewEntryIds(new Set(newEntries.map((entry: FlushingEntry) => entry.id)));
          
          // Clear the animation markers after animation completes
          setTimeout(() => {
            setNewEntryIds(new Set());
          }, 2000);
        } else {
          console.log('No new entries found in this update');
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
  
  // Function to load older entries
  const loadOlderEntries = async () => {
    try {
      // Save current scroll position
      const scrollPosition = window.scrollY;
      
      setLoading(true);
      setError(null);
      
      // Get the oldest entry we currently have
      const oldestEntry = entries[entries.length - 1];
      if (!oldestEntry) {
        return; // No entries to use as cursor
      }
      
      console.log(`Loading older entries before ID ${oldestEntry.id}`);
      
      // Use the oldest entry's ID as the cursor, plus add a unique timestamp
      // Use our simple API for reliable pagination
      const url = `/api/bluesky/feed-simple?before=${oldestEntry.id}&_t=${Date.now()}`;
      
      const response = await fetch(url, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch older entries: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.entries && data.entries.length > 0) {
        console.log(`Loaded ${data.entries.length} older entries`);
        
        // Debug: log the first few older entries
        for (let i = 0; i < Math.min(3, data.entries.length); i++) {
          const entry = data.entries[i];
          console.log(`  Older ${i+1}. ID: ${entry.id}, Handle: @${entry.authorHandle}, Text: "${entry.text.substring(0, 20)}..."`);
        }
        
        // Append the new entries to our existing list
        setEntries([...entries, ...data.entries]);
        
        // Wait for DOM to update with new entries
        setTimeout(() => {
          // Restore scroll position after state update and render
          window.scrollTo({
            top: scrollPosition,
            behavior: 'instant' // Use instant to avoid additional animation
          });
        }, 0);
      } else {
        console.log('No older entries found');
      }
    } catch (err: any) {
      console.error('Error fetching older entries:', err);
      setError(err.message || 'Failed to load older entries');
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
              Like the app? Consider contributing to <a href="https://ko-fi.com/dameis" target="_blank" rel="noopener noreferrer" className={styles.kofiLink}>my toilet paper fund</a>.
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
          <Link href="/stats" className={styles.statsLink}>View Plumbing Stats 🪠</Link>

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
                        aria-label={`Select emoji ${emoji}`}
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
            <p className={styles.feedSubheader}>
              Click on a username to see their flushing profile.
            </p>
          </div>
          <button 
            onClick={async () => {
              try {
                setLoading(true);
                setError(null);
                
                // Use the simple API endpoint with a refresh parameter and timestamp
                const timestamp = Date.now();
                const url = `/api/bluesky/feed-simple?refresh=true&_t=${timestamp}`;
                console.log(`🔄 MANUAL REFRESH @ ${new Date().toISOString()}`);
                console.log(`Using simple API URL: ${url}`);
                
                // Use strong no-cache headers to ensure browsers don't use cached responses
                const response = await fetch(url, {
                  method: 'GET',
                  cache: 'no-store',
                  headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0',
                    'X-Force-Fresh-Data': 'true' // Custom header to signal intent
                  }
                });
                
                if (!response.ok) {
                  console.error(`API error: ${response.status}, ${response.statusText}`);
                  throw new Error(`API error: ${response.status}`);
                }
                
                // Attempt to extract response headers for debugging
                console.log('Response headers:', Object.fromEntries(response.headers.entries()));
                
                const data = await response.json();
                console.log(`Refresh received ${data.entries?.length || 0} entries`);
                
                if (data.entries && data.entries.length > 0) {
                  console.log(`🔍 Highest ID from refresh: ${data.entries[0].id}`);
                  for (let i = 0; i < Math.min(5, data.entries.length); i++) {
                    console.log(`  ${i+1}. ID: ${data.entries[i].id}, Handle: @${data.entries[i].authorHandle}, Text: "${data.entries[i].text.substring(0, 20)}..."`);
                  }
                  
                  // Compare with current entries
                  if (entries.length > 0) {
                    const currentHighestId = entries[0].id;
                    const newHighestId = data.entries[0].id;
                    console.log(`📊 Comparison - Current highest ID: ${currentHighestId}, New highest ID: ${newHighestId}`);
                    
                    if (newHighestId > currentHighestId) {
                      console.log('✅ Refresh successful! New entries are more recent.');
                    } else if (newHighestId === currentHighestId) {
                      console.log('⚠️ Refresh returned same highest ID - no newer entries available.');
                    } else {
                      console.warn('❌ WARNING: New entries have lower IDs than existing ones!');
                    }
                  }
                } else {
                  console.log('No entries returned from refresh');
                }
                
                // Update the entries with the new data
                setEntries(data.entries || []);
              } catch (err) {
                console.error('Manual refresh error:', err);
                setError('Failed to refresh. Try again.');
              } finally {
                setLoading(false);
              }
            }}
            className={styles.refreshButton}
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {error && <div className={styles.error}>{error}</div>}
        
        {/* Debug info (hidden in production) */}
        {entries && entries.length > 0 && (
          <div className={styles.debugInfo} style={{ fontSize: '10px', color: '#666', margin: '5px 0', display: 'none' }}>
            <p>Debug: Latest entry ID: {entries[0].id}, Count: {entries.length}</p>
          </div>
        )}

        {loading ? (
          <div className={styles.loadingContainer}>
            <div className={styles.loader}></div>
            <p>Loading latest entries...</p>
          </div>
        ) : (
          <div className={styles.feedList}>
            {entries.length > 0 ? (
              // Filter first to determine if we have any valid entries
              (() => {
                const validEntries = entries.filter(entry => isAllowedEmoji(entry.emoji));
                return validEntries.length > 0 ? (
                  <>
                    {validEntries.map((entry) => (
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
                                // Check if handle ends with .is
                                entry.authorHandle && entry.authorHandle.endsWith('.is') ? 
                                  // For handles ending with .is, remove the "is" prefix if it exists
                                  (sanitizeText(entry.text).toLowerCase().startsWith('is ') ? 
                                    (entry.text.length > 63 ? `${sanitizeText(entry.text.substring(3, 63))}...` : sanitizeText(entry.text.substring(3))) : 
                                    (entry.text.length > 60 ? `${sanitizeText(entry.text.substring(0, 60))}...` : sanitizeText(entry.text))
                                  ) :
                                  // For regular handles, display normal text
                                  (entry.text.length > 60 ? `${sanitizeText(entry.text.substring(0, 60))}...` : sanitizeText(entry.text))
                              ) : (
                                // If no text, show default message
                                entry.authorHandle && entry.authorHandle.endsWith('.is') ? 
                                  'flushing' : 'is flushing'
                              )}
                            </span>
                          </div>
                          <span className={styles.timestamp}>
                            {formatRelativeTime(entry.createdAt)}
                          </span>
                        </div>
                      </div>
                    ))}
                    
                    <button 
                      className={styles.loadMoreButton}
                      onClick={(e) => {
                        e.preventDefault(); // Prevent default action
                        loadOlderEntries();
                      }}
                      disabled={loading}
                    >
                      {loading ? 'Loading...' : 'Load older flushes'}
                      {!loading && (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="7 13 12 18 17 13"></polyline>
                          <polyline points="7 6 12 11 17 6"></polyline>
                        </svg>
                      )}
                    </button>
                  </>
                ) : (
                  <div className={styles.emptyState}>
                    <p>No valid entries found. Login and be the first to share your status!</p>
                  </div>
                );
              })()
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