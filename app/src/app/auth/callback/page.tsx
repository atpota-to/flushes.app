'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getAccessToken, exportJWK, generateDPoPToken } from '@/lib/bluesky-auth';
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

        // Retrieve stored auth data
        const storedPdsEndpoint = retrieveAuthData('pds_endpoint');
        const storedAuthServer = retrieveAuthData('auth_server');
        
        // Exchange code for tokens - we may need several attempts
        setStatus('Getting access token...');
        console.log('Exchanging code for token...');
        let tokenResponse;
        try {
          // CRITICAL FIX: Use bsky.social for token exchange regardless of PDS host
          // Third-party PDS servers don't implement OAuth endpoints
          let authServer = storedAuthServer || 'https://bsky.social';
          
          // Always use bsky.social for token exchange (even for custom PDS endpoints)
          console.log('Using auth server for token exchange:', authServer);
          
          tokenResponse = await getAccessToken(
            code, 
            codeVerifier, 
            keyPair, 
            authServer
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

        // Save the DPoP nonce from the response
        let dpopNonce = null;
        
        // First check if it's in the response object
        if (tokenResponse.dpop_nonce) {
          dpopNonce = tokenResponse.dpop_nonce;
          console.log('Retrieved DPoP nonce from token response:', dpopNonce);
        }
        
        // If not found in the response object, check localStorage
        // This is useful for third-party PDS servers
        if (!dpopNonce && typeof localStorage !== 'undefined') {
          const storedNonce = localStorage.getItem('dpopNonce');
          if (storedNonce) {
            console.log('Retrieved DPoP nonce from localStorage:', storedNonce);
            dpopNonce = storedNonce;
          }
        }

        setStatus('Getting user profile...');

        // Extract PDS endpoint from the token or from stored value
        let pdsEndpoint = storedPdsEndpoint;
        
        // First, try to decode the access token to extract the PDS endpoint
        try {
          const parts = tokenResponse.access_token.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(atob(parts[1]));
            console.log('Token payload:', {
              ...payload, 
              access_token: tokenResponse.access_token ? '[REDACTED]' : null
            });
            
            if (payload.aud && typeof payload.aud === 'string') {
              if (payload.aud.startsWith('did:web:')) {
                pdsEndpoint = 'https://' + payload.aud.replace('did:web:', '');
                console.log('Extracted PDS endpoint from token did:web aud:', pdsEndpoint);
              } else if (payload.aud.startsWith('https://')) {
                pdsEndpoint = payload.aud;
                console.log('Using https:// aud as PDS endpoint:', pdsEndpoint);
              } else if (payload.iss && payload.iss.startsWith('https://')) {
                pdsEndpoint = payload.iss;
                console.log('Using iss as PDS endpoint:', pdsEndpoint);
              }
            }
          }
        } catch (e) {
          console.warn('Failed to extract PDS endpoint from token:', e);
          
          // If we couldn't extract from token but have the stored endpoint, use that
          if (storedPdsEndpoint) {
            console.log('Using stored PDS endpoint instead:', storedPdsEndpoint);
            pdsEndpoint = storedPdsEndpoint;
          }
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
        
        // For users on third-party PDS servers, make one more request 
        // directly to their PDS to get the correct handle
        if (pdsEndpoint && pdsEndpoint !== 'https://bsky.social' && userDid) {
          try {
            console.log('Making direct request to PDS for handle info:', pdsEndpoint);
            // Make a direct request to repo.describeRepo to get the correct handle
            const describeEndpoint = `${pdsEndpoint}/xrpc/com.atproto.repo.describeRepo?repo=${encodeURIComponent(userDid)}`;
            
            // Generate a DPoP token for this specific request
            const pubKey = await exportJWK(keyPair.publicKey);
            const directDpopToken = await generateDPoPToken(
              keyPair.privateKey,
              pubKey,
              'GET',
              describeEndpoint,
              dpopNonce || undefined,
              tokenResponse.access_token // Include access token for ath claim
            );
            
            const directResponse = await fetch(describeEndpoint, {
              method: 'GET',
              headers: {
                'Authorization': `DPoP ${tokenResponse.access_token}`,
                'DPoP': directDpopToken
              }
            });
            
            if (directResponse.ok) {
              const directData = await directResponse.json();
              if (directData.handle) {
                console.log(`Using handle from direct PDS response: ${directData.handle} instead of ${userHandle}`);
                userHandle = directData.handle;
              }
            }
          } catch (error) {
            console.error('Failed to get direct handle from PDS:', error);
            // Continue with the handle we already have
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

        // Save the final PDS endpoint to use
        // Prioritize the one from token extraction, then the stored one
        const finalPdsEndpoint = pdsEndpoint || storedPdsEndpoint;
        
        // Clear only the temporary auth-related items
        clearAuthData('oauth_state');
        clearAuthData('code_verifier');
        clearAuthData('key_pair');
        clearAuthData('auth_server');
        
        // IMPORTANT: Do NOT clear pdsEndpoint since we need it for API calls!
        
        // Special handling for PDS endpoint - make sure it's in localStorage 
        // as both a regular key and in our auth format
        if (finalPdsEndpoint) {
          console.log('Ensuring PDS endpoint is saved for API calls:', finalPdsEndpoint);
          
          // Save directly to localStorage for legacy code
          localStorage.setItem('pdsEndpoint', finalPdsEndpoint);
          
          // Also save in our auth format
          localStorage.setItem('bsky_auth_pdsEndpoint', finalPdsEndpoint);
          
          // And in sessionStorage for good measure
          try {
            sessionStorage.setItem('pdsEndpoint', finalPdsEndpoint);
          } catch (e) {
            console.warn('Could not save pdsEndpoint to sessionStorage:', e);
          }
        } else {
          console.warn('No PDS endpoint found to save. API calls may fail.');
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