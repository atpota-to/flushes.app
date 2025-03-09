'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAuthorizationUrl, resolveHandleToDid } from '@/lib/bluesky-auth';
import { storeAuthData } from '@/lib/storage-util';
import styles from './login.module.css';

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [handle, setHandle] = useState('');

  // Process login with handle
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!handle) {
      setError('Please enter your Bluesky handle');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
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
      
      // Resolve handle to DID and get PDS endpoint
      const { did, pdsEndpoint, hostname } = await resolveHandleToDid(handle);
      
      if (!did) {
        setError(`Could not resolve handle '${handle}'. Please check and try again.`);
        setIsLoading(false);
        return;
      }
      
      if (!pdsEndpoint) {
        setError(`Could not determine PDS endpoint for handle '${handle}'.`);
        setIsLoading(false);
        return;
      }
      
      // Check if this is a bsky.network PDS
      const isBskyNetwork = hostname?.includes('bsky.network') || false;
      
      // For bsky.network endpoints, use the default AUTH_SERVER (bsky.social)
      // For other PDS servers, use their actual endpoint
      let authUrl, state, codeVerifier, keyPair;
      
      if (isBskyNetwork) {
        console.log('Using standard Bluesky OAuth flow for bsky.network PDS');
        // Use the standard AUTH_SERVER for bsky.network endpoints
        const authData = await getAuthorizationUrl();
        authUrl = authData.url;
        state = authData.state;
        codeVerifier = authData.codeVerifier;
        keyPair = authData.keyPair;
      } else {
        console.log('Using custom PDS OAuth flow for:', pdsEndpoint);
        // Use the custom PDS endpoint for OAuth
        const authData = await getAuthorizationUrl(pdsEndpoint);
        authUrl = authData.url;
        state = authData.state;
        codeVerifier = authData.codeVerifier;
        keyPair = authData.keyPair;
      }
      
      // Store auth state
      try {
        // Serialize the key pair
        const publicJwk = await window.crypto.subtle.exportKey('jwk', keyPair.publicKey);
        const privateJwk = await window.crypto.subtle.exportKey('jwk', keyPair.privateKey);
        const serializedKeyPair = JSON.stringify({ publicKey: publicJwk, privateKey: privateJwk });
        
        // Store all values
        const stateStored = storeAuthData('oauth_state', state);
        const verifierStored = storeAuthData('code_verifier', codeVerifier);
        const keyPairStored = storeAuthData('key_pair', serializedKeyPair);
        
        // For bsky.network endpoints, standardize on bsky.social as the auth server
        // while still storing the actual PDS endpoint for API calls
        if (isBskyNetwork) {
          const authServerStored = storeAuthData('auth_server', 'https://bsky.social');
          const pdsStored = storeAuthData('pds_endpoint', pdsEndpoint);
          
          if (!stateStored || !verifierStored || !keyPairStored || !authServerStored || !pdsStored) {
            throw new Error('Failed to store one or more authentication values');
          }
        } else {
          // For custom PDS endpoints, use them for both auth and API calls
          const pdsStored = storeAuthData('pds_endpoint', pdsEndpoint);
          
          if (!stateStored || !verifierStored || !keyPairStored || !pdsStored) {
            throw new Error('Failed to store one or more authentication values');
          }
        }
        
        console.log('OAuth data stored successfully:', {
          pdsEndpoint,
          statePrefix: state.substring(0, 5) + '...'
        });
      } catch (storageError) {
        console.error('Error storing OAuth state:', storageError);
        setError('Failed to store login state. Please ensure cookies and storage are enabled.');
        setIsLoading(false);
        return;
      }
      
      // Redirect to login
      window.location.href = authUrl;
    } catch (err: any) {
      console.error('Failed to initiate login:', err);
      setError(`Login failed: ${err.message || 'Unknown error'}`);
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      {isLoading ? (
        <div className={styles.loaderContainer}>
          <div className={styles.loader}></div>
          <p>Setting up login...</p>
        </div>
      ) : (
        <div className={styles.loginForm}>
          <h1>Login with Bluesky</h1>
          <p className={styles.subtitle}>using your AT Protocol account</p>
          <p className={styles.description}>
            Enter your Bluesky handle to continue. This works with any Bluesky account,
            including those on custom PDS servers.
          </p>
          
          {error && <p className={styles.error}>{error}</p>}
          
          <form onSubmit={handleLogin}>
            <div className={styles.inputGroup}>
              <input
                type="text"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                placeholder="yourusername.bsky.social"
                className={styles.input}
                disabled={isLoading}
              />
              <button 
                type="submit" 
                className={styles.loginButton}
                disabled={isLoading}
              >
                Continue
              </button>
            </div>
            <p className={styles.helpText}>
              Examples: alice.bsky.social, bob.com, etc.
            </p>
          </form>
          
          <button onClick={() => router.push('/')} className={styles.backButton}>
            Back to Home
          </button>
        </div>
      )}
    </div>
  );
}