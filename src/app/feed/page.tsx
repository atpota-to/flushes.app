'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import styles from './feed.module.css';
import { formatRelativeTime } from '@/lib/time-utils';
import { useAuth } from '@/lib/auth-context';
import EditFlushModal from '@/components/EditFlushModal';

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
  const { isAuthenticated, session } = useAuth();
  const [editingFlush, setEditingFlush] = useState<FlushingEntry | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

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
  
  // Function to load older entries
  const loadOlderEntries = async () => {
    try {
      // Save reference to the "Load older flushes" button element to measure its position
      const loadMoreButton = document.getElementById('load-more-button');
      const buttonPosition = loadMoreButton?.getBoundingClientRect();
      
      setLoading(true);
      setError(null);
      
      // Get the oldest entry we currently have
      const oldestEntry = entries[entries.length - 1];
      if (!oldestEntry) {
        return; // No entries to use as cursor
      }
      
      // Use the oldest entry's ID as the cursor
      const url = `/api/bluesky/feed?before=${oldestEntry.id}`;
      
      const response = await fetch(url, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch older entries: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.entries && data.entries.length > 0) {
        // Get the current document height before adding new content
        const oldDocumentHeight = document.body.scrollHeight;
        
        // Append the new entries to our existing list
        setEntries(prevEntries => [...prevEntries, ...data.entries]);
        
        // After state update, maintain position relative to the Load More button
        if (buttonPosition) {
          // Use requestAnimationFrame to ensure DOM has updated
          requestAnimationFrame(() => {
            // Get the button's new position
            const newButtonElement = document.getElementById('load-more-button');
            
            if (newButtonElement) {
              // Calculate where to scroll to keep the button in the same viewport position
              const newButtonPosition = newButtonElement.getBoundingClientRect();
              const newScrollY = window.scrollY + (newButtonPosition.top - buttonPosition.top);
              
              // Scroll to the calculated position
              window.scrollTo({
                top: newScrollY,
                behavior: 'instant' // Use instant to avoid animation
              });
            }
          });
        }
      }
    } catch (err: any) {
      console.error('Error fetching older entries:', err);
      setError(err.message || 'Failed to load older entries');
    } finally {
      setLoading(false);
    }
  };

  // Check if the current user owns this flush
  const isOwnFlush = (authorDid: string) => {
    if (!session) return false;
    return session.sub === authorDid;
  };

  // Handle updating a flush
  const handleUpdateFlush = async (text: string, emoji: string) => {
    if (!session || !editingFlush) {
      setActionError('You must be logged in to update a flush');
      return;
    }

    try {
      setActionError(null);
      setActionSuccess(null);

      const { updateFlushRecord } = await import('@/lib/api-client');
      
      await updateFlushRecord(
        session,
        editingFlush.uri,
        text,
        emoji,
        editingFlush.createdAt
      );

      setActionSuccess('Flush updated successfully!');
      
      // Update the local state
      setEntries(entries.map(entry => 
        entry.uri === editingFlush.uri 
          ? { ...entry, text, emoji }
          : entry
      ));

      // Clear success message after 3 seconds
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (error: any) {
      console.error('Error updating flush:', error);
      setActionError(error.message || 'Failed to update flush');
    }
  };

  // Handle deleting a flush
  const handleDeleteFlush = async () => {
    if (!session || !editingFlush) {
      setActionError('You must be logged in to delete a flush');
      return;
    }

    try {
      setActionError(null);
      setActionSuccess(null);

      const { deleteFlushRecord } = await import('@/lib/api-client');
      
      await deleteFlushRecord(session, editingFlush.uri);

      setActionSuccess('Flush deleted successfully!');
      
      // Remove from local state
      setEntries(entries.filter(entry => entry.uri !== editingFlush.uri));

      // Clear success message after 3 seconds
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (error: any) {
      console.error('Error deleting flush:', error);
      setActionError(error.message || 'Failed to delete flush');
    }
  };

  // No longer needed - using formatRelativeTime from time-utils

  return (
    <div className={styles.container}>
      
      {/* Action messages */}
      {actionError && (
        <div className={styles.actionError}>
          {actionError}
        </div>
      )}
      
      {actionSuccess && (
        <div className={styles.actionSuccess}>
          {actionSuccess}
        </div>
      )}

      {/* Edit Modal */}
      <EditFlushModal
        isOpen={editingFlush !== null}
        flushData={editingFlush ? {
          uri: editingFlush.uri,
          text: editingFlush.text,
          emoji: editingFlush.emoji,
          created_at: editingFlush.createdAt
        } : null}
        onSave={handleUpdateFlush}
        onDelete={handleDeleteFlush}
        onClose={() => setEditingFlush(null)}
      />
      
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
          <>
            {entries.map((entry) => (
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
                  <div className={styles.headerRight}>
                    <span className={styles.timestamp}>
                      {formatRelativeTime(entry.createdAt)}
                    </span>
                    {isOwnFlush(entry.authorDid) && isAuthenticated && (
                      <button
                        className={styles.editButton}
                        onClick={() => setEditingFlush(entry)}
                        aria-label="Edit flush"
                        title="Edit or delete this flush"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
                <div className={styles.content}>
                  <span className={styles.emoji}>{entry.emoji}</span>
                  <span className={styles.text}>{entry.text.length > 60 ? `${entry.text.substring(0, 60)}...` : entry.text}</span>
                </div>
              </div>
            ))}
            
            <button 
              className={styles.loadMoreButton}
              id="load-more-button"
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