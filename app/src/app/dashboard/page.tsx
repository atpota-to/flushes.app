'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { createFlushingStatus, checkAuth } from '@/lib/bluesky-api';
import styles from './dashboard.module.css';

// List of relevant emojis for flushing situations
const EMOJIS = [
  '🚽', '💩', '🧻', '📱', '💧', '🚿', '🛁', '📚', '💭', '💦', '🔊', '🤫', 
  '⏱️', '⌛', '🧠', '💨', '🙈', '🙉', '😬', '😌', '😓', '😳', '😅', '🥴'
];

export default function DashboardPage() {
  const router = useRouter();
  const { isAuthenticated, accessToken, did, handle, serializedKeyPair, dpopNonce, pdsEndpoint, clearAuth } = useAuth();
  
  const [text, setText] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState(EMOJIS[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    // Redirect to home if not authenticated
    if (!isAuthenticated) {
      router.push('/');
    }
  }, [isAuthenticated, router]);

  // Logout handler
  const handleLogout = () => {
    clearAuth();
    router.push('/');
  };

  // Submit flushing status
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!text) {
      setError('Please enter a status message');
      return;
    }

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
        <h1>I&apos;m Flushing Dashboard</h1>
        <div className={styles.userInfo}>
          <span>Logged in as: @{handle}</span>
          <div className={styles.actions}>
            <button 
              onClick={() => router.push('/feed')} 
              className={styles.feedButton}
            >
              View Feed
            </button>
            <button onClick={handleLogout} className={styles.logoutButton}>
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className={styles.card}>
        <h2>Update Your Flushing Status</h2>
        <p className={styles.description}>
          Share what&apos;s happening in the bathroom right now. Your status 
          will be saved to your Bluesky account with the custom schema: 
          <code className={styles.code}>im.flushing.right.now</code>
        </p>

        {error && <div className={styles.error}>{error}</div>}
        {success && <div className={styles.success}>{success}</div>}

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGroup}>
            <label htmlFor="status">What&apos;s your status?</label>
            <input
              type="text"
              id="status"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="What's happening in the bathroom..."
              maxLength={280}
              className={styles.input}
              disabled={isSubmitting}
            />
            <div className={styles.charCount}>
              {text.length}/280
            </div>
          </div>

          <div className={styles.formGroup}>
            <label>Select an emoji</label>
            <div className={styles.emojiGrid}>
              {EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className={`${styles.emojiButton} ${
                    emoji === selectedEmoji ? styles.selectedEmoji : ''
                  }`}
                  onClick={() => setSelectedEmoji(emoji)}
                  disabled={isSubmitting}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.preview}>
            <div className={styles.previewTitle}>Preview:</div>
            <div className={styles.previewContent}>
              <span className={styles.previewEmoji}>{selectedEmoji}</span>
              <span>{text || 'Your status will appear here'}</span>
            </div>
          </div>

          <button
            type="submit"
            className={styles.submitButton}
            disabled={isSubmitting || !text}
          >
            {isSubmitting ? 'Updating...' : 'Update Status'}
          </button>
        </form>
      </div>
    </div>
  );
}