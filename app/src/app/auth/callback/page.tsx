'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getAccessToken } from '@/lib/bluesky-auth';
import { getProfile } from '@/lib/bluesky-api';
import { useAuth } from '@/lib/auth-context';
import styles from './callback.module.css';

export default function CallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAuth } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('Processing login...');

  useEffect(() => {
    async function handleCallback() {
      try {
        // Get parameters from URL
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const iss = searchParams.get('iss');
        
        if (!code || !state || !iss) {
          setError('Invalid callback parameters');
          return;
        }

        // Get stored values from session storage
        const storedState = sessionStorage.getItem('oauth_state');
        const codeVerifier = sessionStorage.getItem('code_verifier');
        const serializedKeyPair = sessionStorage.getItem('key_pair');

        // Validate state
        if (state !== storedState) {
          setError('Invalid state parameter');
          return;
        }

        if (!codeVerifier || !serializedKeyPair) {
          setError('Missing authorization data');
          return;
        }

        setStatus('Exchanging authorization code...');

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

        // Exchange code for tokens
        const tokenResponse = await getAccessToken(code, codeVerifier, keyPair);
        
        if (!tokenResponse.access_token || !tokenResponse.refresh_token) {
          setError('Failed to get access token');
          return;
        }

        setStatus('Getting user profile...');

        // Get user profile
        const profileResponse = await getProfile(
          tokenResponse.access_token,
          keyPair,
          null
        );

        // Serialize key pair for storage
        const serializedKeysForStorage = JSON.stringify({
          publicKey: keyPairData.publicKey,
          privateKey: keyPairData.privateKey
        });

        // Store auth data
        setAuth({
          accessToken: tokenResponse.access_token,
          refreshToken: tokenResponse.refresh_token,
          did: tokenResponse.sub,
          handle: profileResponse?.handle || 'unknown',
          serializedKeyPair: serializedKeysForStorage,
          dpopNonce: null
        });

        // Clear session storage
        sessionStorage.removeItem('oauth_state');
        sessionStorage.removeItem('code_verifier');
        sessionStorage.removeItem('key_pair');

        // Redirect to dashboard
        router.push('/dashboard');
      } catch (err: any) {
        console.error('Login callback error:', err);
        setError(`Login failed: ${err.message || 'Unknown error'}`);
      }
    }

    handleCallback();
  }, [searchParams, router, setAuth]);

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.errorContainer}>
          <h1>Authentication Error</h1>
          <p className={styles.error}>{error}</p>
          <button onClick={() => router.push('/')} className={styles.button}>
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
        <p>{status}</p>
      </div>
    </div>
  );
}