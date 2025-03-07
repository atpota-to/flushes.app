'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAuthorizationUrl } from '@/lib/bluesky-auth';
import styles from './login.module.css';

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    // Mark that we're on the client side
    setIsClient(true);
  }, []);

  useEffect(() => {
    // Only run this effect on the client
    if (!isClient) return;

    async function initiateLogin() {
      try {
        // Check if we have access to required browser APIs
        if (typeof window === 'undefined' || 
            !window.crypto || 
            !window.crypto.subtle || 
            !window.sessionStorage) {
          setError('Your browser does not support the required security features');
          setIsLoading(false);
          return;
        }

        // Get authorization URL
        const { url, state, codeVerifier, keyPair } = await getAuthorizationUrl();
        
        // Store auth state in sessionStorage
        try {
          // Clear any old values first
          sessionStorage.removeItem('oauth_state');
          sessionStorage.removeItem('code_verifier');
          sessionStorage.removeItem('key_pair');
          
          // Set new values
          sessionStorage.setItem('oauth_state', state);
          sessionStorage.setItem('code_verifier', codeVerifier);
          
          // Serialize and store keyPair
          const publicJwk = await window.crypto.subtle.exportKey('jwk', keyPair.publicKey);
          const privateJwk = await window.crypto.subtle.exportKey('jwk', keyPair.privateKey);
          const serializedKeyPair = JSON.stringify({ publicKey: publicJwk, privateKey: privateJwk });
          sessionStorage.setItem('key_pair', serializedKeyPair);
          
          // Double-check that values were stored correctly
          const storedState = sessionStorage.getItem('oauth_state');
          const storedVerifier = sessionStorage.getItem('code_verifier');
          const storedKeyPair = sessionStorage.getItem('key_pair');
          
          if (!storedState || !storedVerifier || !storedKeyPair) {
            throw new Error('Failed to store authentication data');
          }
          
          console.log('OAuth state stored successfully:', state.substring(0, 5) + '...');
        } catch (storageError) {
          console.error('Error storing OAuth state:', storageError);
          setError('Failed to store login state. Please ensure cookies and storage are enabled.');
          setIsLoading(false);
          return;
        }
        
        // Redirect to Bluesky login
        window.location.href = url;
      } catch (err) {
        console.error('Failed to initiate login:', err);
        setError('Failed to initiate login. Please try again.');
        setIsLoading(false);
      }
    }

    initiateLogin();
  }, [isClient]);

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.errorContainer}>
          <h1>Login Error</h1>
          <p className={styles.error}>{error}</p>
          <button onClick={() => router.push('/')} className={styles.backButton}>
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.loaderContainer}>
        <div className={styles.loader}></div>
        <p>Redirecting to Bluesky login...</p>
      </div>
    </div>
  );
}