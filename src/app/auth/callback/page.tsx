'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import styles from './callback.module.css';

// Loading component to show while waiting
function CallbackLoader() {
  return (
    <div className={styles.container}>
      <div className={styles.loaderContainer}>
        <div className={styles.loader}></div>
        <p>Processing login...</p>
      </div>
    </div>
  );
}

// Main callback handler component
function CallbackHandler() {
  const router = useRouter();
  const { session, isLoading } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [processed, setProcessed] = useState(false);

  useEffect(() => {
    // Prevent double processing
    if (processed) return;

    // The OAuth client handles the callback automatically during initialization
    // We just need to wait for the session to be available or an error to occur
    
    // Set a timeout to handle potential issues
    const timeout = setTimeout(() => {
      if (!session && !isLoading) {
        console.error('OAuth callback processing timed out');
        setError('Login process timed out. Please try again.');
      }
    }, 30000); // 30 second timeout

    // Clean up timeout if component unmounts
    return () => {
      clearTimeout(timeout);
      setProcessed(true);
    };
  }, [session, isLoading, processed]);

  // Once we have a session, redirect to home
  useEffect(() => {
    if (session && !isLoading) {
      console.log(`Successfully authenticated user: ${session.sub}`);
      
      // Small delay to show success state
      setTimeout(() => {
        router.push('/');
      }, 1000);
    }
  }, [session, isLoading, router]);

  // Handle cases where the OAuth flow fails
  useEffect(() => {
    // Check for error parameters in the URL
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const urlError = urlParams.get('error');
      const errorDescription = urlParams.get('error_description');
      
      if (urlError) {
        console.error(`OAuth error in URL: ${urlError} - ${errorDescription}`);
        setError(`Authentication error: ${errorDescription || urlError}`);
        return;
      }

      // Also check hash params (since we use fragment mode)
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const hashError = hashParams.get('error');
      const hashErrorDescription = hashParams.get('error_description');
      
      if (hashError) {
        console.error(`OAuth error in hash: ${hashError} - ${hashErrorDescription}`);
        setError(`Authentication error: ${hashErrorDescription || hashError}`);
        return;
      }
    }

    // If we're not loading and don't have a session after a reasonable time,
    // something went wrong
    if (!isLoading && !session) {
      const timer = setTimeout(() => {
        if (!session) {
          console.error('No session available after callback processing');
          setError('Failed to complete authentication. Please try again.');
        }
      }, 5000); // Wait 5 seconds for session to appear

      return () => clearTimeout(timer);
    }
  }, [isLoading, session]);

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.errorContainer}>
          <h1>Authentication Error</h1>
          <p className={styles.error}>{error}</p>
          <button onClick={() => router.push('/auth/login')} className={styles.button}>
            Try Again
          </button>
          <button onClick={() => router.push('/')} className={styles.button}>
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  if (session) {
    return (
      <div className={styles.container}>
        <div className={styles.successContainer}>
          <div className={styles.checkmark}>✓</div>
          <h1>Welcome back!</h1>
          <p>Successfully signed in! Redirecting...</p>
          <p>Redirecting to home page...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.loaderContainer}>
        <div className={styles.loader}></div>
        <p>Completing authentication...</p>
      </div>
    </div>
  );
}

// Main export with Suspense boundary
export default function CallbackPage() {
  return (
    <Suspense fallback={<CallbackLoader />}>
      <CallbackHandler />
    </Suspense>
  );
} 