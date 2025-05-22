'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import styles from './login.module.css';

export default function LoginPage() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [handle, setHandle] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!handle.trim()) {
      setError('Please enter your handle or DID');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log(`Starting OAuth flow for: ${handle}`);
      
      // The signIn function will redirect to the OAuth server
      // We won't reach the code after this call
      await signIn(handle.trim());
      
      // This line should never be reached due to redirect
      console.log('This should not be logged - redirect should have occurred');
      
    } catch (error: any) {
      console.error('Login error:', error);
      setError(error.message || 'Failed to start login process');
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.loginBox}>
        <h1 className={styles.title}>Sign in to Flushes</h1>
        <p className={styles.subtitle}>
          Connect with your AT Protocol account
        </p>

        <form onSubmit={handleLogin} className={styles.form}>
          <div className={styles.inputGroup}>
            <label htmlFor="handle" className={styles.label}>
              Handle or DID
            </label>
            <input
              id="handle"
              type="text"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="e.g., alice.bsky.social or did:plc:..."
              className={styles.input}
              disabled={isLoading}
              autoComplete="username"
              autoFocus
            />
            <p className={styles.hint}>
              Enter your Bluesky handle, custom domain, or DID identifier
            </p>
          </div>

          {error && (
            <div className={styles.error} role="alert">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || !handle.trim()}
            className={styles.submitButton}
          >
            {isLoading ? (
              <>
                <span className={styles.spinner}></span>
                Connecting...
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <div className={styles.info}>
          <h3>Supported Services</h3>
          <ul>
            <li>Bluesky (bsky.social)</li>
            <li>Custom domains (e.g., alice.example.com)</li>
            <li>Third-party PDS servers</li>
            <li>Self-hosted instances</li>
          </ul>
        </div>

        <div className={styles.footer}>
          <button onClick={() => router.push('/')} className={styles.backButton}>
            ← Back to Home
          </button>
        </div>
      </div>
    </div>
  );
} 