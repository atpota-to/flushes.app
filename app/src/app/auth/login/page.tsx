'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getAuthorizationUrl, resolveHandleToDid } from '@/lib/bluesky-auth';
import { storeAuthData } from '@/lib/storage-util';
import styles from './login.module.css';

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [handle, setHandle] = useState('');
  const [suggestions, setSuggestions] = useState<Array<{did: string, handle: string, avatar?: string}>>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current && 
        !suggestionsRef.current.contains(event.target as Node) &&
        !inputRef.current?.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  // Handle suggestions with debouncing
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    // Don't search for very short queries
    if (!handle || handle.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    
    // Set debounce timer
    debounceTimerRef.current = setTimeout(async () => {
      try {
        setLoadingSuggestions(true);
        
        // Format query - remove @ if present
        const searchQuery = handle.trim().startsWith('@') 
          ? handle.trim().substring(1) 
          : handle.trim();
        
        // Call Bluesky API
        const response = await fetch(
          `https://public.api.bsky.app/xrpc/app.bsky.actor.searchActorsTypeahead?q=${encodeURIComponent(searchQuery)}&limit=5`
        );
        
        if (response.ok) {
          const data = await response.json();
          if (data.actors && Array.isArray(data.actors)) {
            setSuggestions(data.actors.map((actor: any) => ({
              did: actor.did,
              handle: actor.handle,
              avatar: actor.avatar
            })));
            setShowSuggestions(true);
          }
        }
      } catch (error) {
        console.error('Error fetching suggestions:', error);
      } finally {
        setLoadingSuggestions(false);
      }
    }, 300);
    
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [handle]);

  // Handle selecting a suggestion
  const handleSuggestionClick = (selectedHandle: string) => {
    setHandle(selectedHandle);
    setShowSuggestions(false);
  };
  
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
      let authUrl, state, codeVerifier, keyPair, authorizationEndpoint;
      
      if (isBskyNetwork) {
        console.log('Using standard Bluesky OAuth flow for bsky.network PDS');
        // Use the standard AUTH_SERVER for bsky.network endpoints
        const authData = await getAuthorizationUrl();
        authUrl = authData.url;
        state = authData.state;
        codeVerifier = authData.codeVerifier;
        keyPair = authData.keyPair;
        authorizationEndpoint = authData.pdsEndpoint;
        
        console.log('Standard OAuth flow details:', {
          pdsType: 'bsky.network',
          authEndpoint: authorizationEndpoint,
          statePrefix: state.substring(0, 5) + '...',
          codeVerifierLength: codeVerifier.length
        });
      } else {
        console.log('Using custom PDS OAuth flow for:', pdsEndpoint);
        // Use the custom PDS endpoint for OAuth
        const authData = await getAuthorizationUrl(pdsEndpoint);
        authUrl = authData.url;
        state = authData.state;
        codeVerifier = authData.codeVerifier;
        keyPair = authData.keyPair;
        authorizationEndpoint = authData.pdsEndpoint;
        
        console.log('Custom PDS OAuth flow details:', {
          pdsType: 'third-party',
          pdsEndpoint,
          authEndpoint: authorizationEndpoint,
          statePrefix: state.substring(0, 5) + '...',
          codeVerifierLength: codeVerifier.length,
          redirectUri: 'https://flushes.app/auth/callback' // Expected to be this
        });
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
              <div className={styles.inputWithSuggestions}>
                <input
                  ref={inputRef}
                  type="text"
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                  placeholder="yourusername.bsky.social"
                  className={styles.input}
                  disabled={isLoading}
                />
                
                {/* Suggestions dropdown */}
                {showSuggestions && (
                  <div className={styles.suggestionsContainer} ref={suggestionsRef}>
                    {loadingSuggestions ? (
                      <div className={styles.loadingContainer}>
                        <div className={styles.loadingDot}></div>
                        <div className={styles.loadingDot}></div>
                        <div className={styles.loadingDot}></div>
                      </div>
                    ) : suggestions.length > 0 ? (
                      <ul className={styles.suggestionsList}>
                        {suggestions.map((suggestion) => (
                          <li key={suggestion.did} className={styles.suggestionItem}>
                            <button 
                              type="button" 
                              className={styles.suggestionButton}
                              onClick={() => handleSuggestionClick(suggestion.handle)}
                            >
                              {suggestion.avatar ? (
                                <img 
                                  src={suggestion.avatar} 
                                  alt={suggestion.handle} 
                                  className={styles.avatar}
                                  width={28}
                                  height={28}
                                />
                              ) : (
                                <div className={styles.avatarPlaceholder}></div>
                              )}
                              <span className={styles.handle}>@{suggestion.handle}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className={styles.noResults}>No results found</div>
                    )}
                  </div>
                )}
              </div>
              
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