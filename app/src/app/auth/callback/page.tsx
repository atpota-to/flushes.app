'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getAccessToken } from '@/lib/bluesky-auth';
import { getProfile } from '@/lib/bluesky-api';
import { useAuth } from '@/lib/auth-context';
import { retrieveAuthData, clearAuthData } from '@/lib/storage-util';
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
  const searchParams = useSearchParams();
  const { setAuth } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('Processing login...');
  const [isClient, setIsClient] = useState(false);
  const [processed, setProcessed] = useState(false); // Track if we've already processed the callback

  // Set isClient to true once component mounts
  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    // Only proceed if we're on the client side and haven't processed the callback yet
    if (!isClient || processed) return;
    
    // Mark as processed immediately to prevent duplicate processing
    setProcessed(true);

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

        // Get stored values from our robust storage utility
        if (typeof window === 'undefined') {
          setError('Browser environment not available');
          return;
        }

        const storedState = retrieveAuthData('oauth_state');
        const codeVerifier = retrieveAuthData('code_verifier');
        const serializedKeyPair = retrieveAuthData('key_pair');
        
        // Check if we have the stored values
        if (!storedState) {
          setError('Session data lost. Please try logging in again.');
          return;
        }

        // Validate state
        if (state !== storedState) {
          console.error('State mismatch. Received:', state, 'Stored:', storedState);
          setError('Invalid state parameter. This may be due to an expired session or a security issue.');
          return;
        }

        if (!codeVerifier || !serializedKeyPair) {
          setError('Missing authorization data');
          return;
        }

        setStatus('Exchanging authorization code...');

        // Check if crypto is available
        if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
          setError('Web Crypto API not available');
          return;
        }

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

        // Check if we have a PDS endpoint in sessionStorage
        const storedPdsEndpoint = retrieveAuthData('pds_endpoint');
        
        // Exchange code for tokens - we may need several attempts
        setStatus('Getting access token...');
        console.log('Exchanging code for token...');
        let tokenResponse;
        try {
          // Pass the PDS endpoint if we have it
          tokenResponse = await getAccessToken(
            code, 
            codeVerifier, 
            keyPair, 
            storedPdsEndpoint || undefined
          );
        } catch (tokenError: any) {
          console.error('Token exchange error:', tokenError);
          setError(`Failed to get access token: ${tokenError.message}`);
          return;
        }
        
        if (!tokenResponse.access_token || !tokenResponse.refresh_token) {
          setError('Token response missing required fields');
          return;
        }

        // Save the DPoP nonce from the response headers if present
        let dpopNonce = null;
        if (tokenResponse.dpop_nonce) {
          dpopNonce = tokenResponse.dpop_nonce;
        }

        setStatus('Getting user profile...');

        // Extract PDS endpoint from the token
        let pdsEndpoint = null;
        
        // First, try to decode the access token
        try {
          const parts = tokenResponse.access_token.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(atob(parts[1]));
            if (payload.aud && typeof payload.aud === 'string' && payload.aud.startsWith('did:web:')) {
              pdsEndpoint = 'https://' + payload.aud.replace('did:web:', '');
            }
          }
        } catch (e) {
          console.warn('Failed to extract PDS endpoint from token');
        }
        
        // Get user profile
        let profileResponse;
        try {
          profileResponse = await getProfile(
            tokenResponse.access_token,
            keyPair,
            dpopNonce,
            undefined, // Use default handle
            pdsEndpoint // Pass the PDS endpoint if we have it
          );
        } catch (profileError: any) {
          console.error('Profile fetch error:', profileError);
          // Continue anyway - we at least have the tokens
          profileResponse = { handle: 'unknown_user' };
        }

        // Serialize key pair for storage
        const serializedKeysForStorage = JSON.stringify({
          publicKey: keyPairData.publicKey,
          privateKey: keyPairData.privateKey
        });

        // Extract the DID from the token response
        const userDid = tokenResponse.sub;
        console.log('User DID from token:', userDid);
        
        // If we were able to extract the PDS endpoint, log it
        if (pdsEndpoint) {
          console.log('Extracted PDS endpoint from token:', pdsEndpoint);
        } else {
          console.warn('Could not extract PDS endpoint from token');
        }
        
        // Now that we have the PDS endpoint, try to get the user's handle directly
        // First try to use the profileResponse we already have
        let userHandle = profileResponse?.handle;
        
        // If we don't have a handle yet, try to resolve it using the user's DID
        if (!userHandle || userHandle === 'unknown' || userHandle === 'unknown_user') {
          try {
            console.log('Getting user handle from DID...');
            // Try to make a direct call to resolve the handle from the DID
            const handleResponse = await getProfile(
              tokenResponse.access_token,
              keyPair,
              dpopNonce,
              userDid, // Use the user's DID instead of default
              pdsEndpoint // Pass the PDS endpoint if we have it
            );
            
            if (handleResponse && handleResponse.handle) {
              userHandle = handleResponse.handle;
              console.log('Successfully resolved user handle:', userHandle);
            } else {
              userHandle = 'unknown';
            }
          } catch (error) {
            console.error('Failed to resolve user handle:', error);
            userHandle = 'unknown';
          }
        }
        
        // Store auth data
        setAuth({
          accessToken: tokenResponse.access_token,
          refreshToken: tokenResponse.refresh_token,
          did: userDid,
          handle: userHandle,
          serializedKeyPair: serializedKeysForStorage,
          dpopNonce: dpopNonce,
          pdsEndpoint: pdsEndpoint // Store the PDS endpoint for later use
        });

        // Clear all auth-related storage items
        clearAuthData('oauth_state');
        clearAuthData('code_verifier');
        clearAuthData('key_pair');
        clearAuthData('pds_endpoint');
        
        // Also try to clear any leftover sessionStorage items
        try {
          sessionStorage.clear();
        } catch (e) {
          console.warn('Failed to clear session storage:', e);
        }

        // Redirect to home page
        router.push('/');
      } catch (err: any) {
        console.error('Login callback error:', err);
        setError(`Login failed: ${err.message || 'Unknown error'}`);
      }
    }

    handleCallback();
  }, [searchParams, router, setAuth, isClient]);

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

// Main export with Suspense boundary
export default function CallbackPage() {
  return (
    <Suspense fallback={<CallbackLoader />}>
      <CallbackHandler />
    </Suspense>
  );
}