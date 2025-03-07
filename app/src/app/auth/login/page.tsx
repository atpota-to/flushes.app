'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAuthorizationUrl } from '@/lib/bluesky-auth';
import styles from './login.module.css';

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function initiateLogin() {
      try {
        // Get authorization URL
        const { url, state, codeVerifier, keyPair } = await getAuthorizationUrl();
        
        // Store auth state in sessionStorage
        sessionStorage.setItem('oauth_state', state);
        sessionStorage.setItem('code_verifier', codeVerifier);
        
        // Serialize and store keyPair
        const publicJwk = await window.crypto.subtle.exportKey('jwk', keyPair.publicKey);
        const privateJwk = await window.crypto.subtle.exportKey('jwk', keyPair.privateKey);
        const serializedKeyPair = JSON.stringify({ publicKey: publicJwk, privateKey: privateJwk });
        sessionStorage.setItem('key_pair', serializedKeyPair);
        
        // Redirect to Bluesky login
        window.location.href = url;
      } catch (err) {
        console.error('Failed to initiate login:', err);
        setError('Failed to initiate login. Please try again.');
        setIsLoading(false);
      }
    }

    initiateLogin();
  }, []);

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