'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface AuthContextType {
  isAuthenticated: boolean;
  accessToken: string | null;
  refreshToken: string | null;
  did: string | null;
  handle: string | null;
  serializedKeyPair: string | null;
  dpopNonce: string | null;
  pdsEndpoint: string | null;
  setAuth: (auth: {
    accessToken: string;
    refreshToken: string;
    did: string;
    handle: string;
    serializedKeyPair: string;
    dpopNonce?: string | null;
    pdsEndpoint?: string | null;
  }) => void;
  clearAuth: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [did, setDid] = useState<string | null>(null);
  const [handle, setHandle] = useState<string | null>(null);
  const [serializedKeyPair, setSerializedKeyPair] = useState<string | null>(null);
  const [dpopNonce, setDpopNonce] = useState<string | null>(null);
  const [pdsEndpoint, setPdsEndpoint] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [lastTokenRefresh, setLastTokenRefresh] = useState<number>(0);

  // Function to check token and refresh if needed
  const checkAndRefreshToken = async () => {
    if (!accessToken || !refreshToken || !serializedKeyPair || !did || !pdsEndpoint) {
      return;
    }

    try {
      // Dynamically import isTokenExpired and refreshAccessToken
      const { isTokenExpired, refreshAccessToken } = await import('./bluesky-api');
      
      // Check if token is expired or expiring soon
      if (isTokenExpired(accessToken)) {
        console.log('[AUTH CONTEXT] Access token is expired or expiring soon, refreshing...');
        
        // Deserialize keypair
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
        
        // Get the current DPoP nonce from localStorage if available
        let currentNonce = dpopNonce;
        if (!currentNonce && typeof localStorage !== 'undefined') {
          currentNonce = localStorage.getItem('dpopNonce');
          if (currentNonce) {
            console.log('[AUTH CONTEXT] Retrieved nonce from localStorage:', currentNonce);
            // Update state with the nonce from localStorage
            setDpopNonce(currentNonce);
          }
        }
        
        console.log('[AUTH CONTEXT] Refreshing token for PDS:', pdsEndpoint);
        
        // Refresh the token with enhanced error handling
        try {
          // CRITICAL FIX: Follow the same server selection logic as in refreshAccessToken
          let refreshAuthServer = pdsEndpoint;
          
          // For bsky.network PDSes, use bsky.social
          if (pdsEndpoint.includes('bsky.network')) {
            console.log('[AUTH CONTEXT] Using bsky.social for token refresh with bsky.network PDS');
            refreshAuthServer = 'https://bsky.social';
          } else if (pdsEndpoint.includes('bsky.social')) {
            // Already using bsky.social
            console.log('[AUTH CONTEXT] Using bsky.social directly for token refresh');
          } else {
            // For third-party PDSes, use their own endpoint
            console.log('[AUTH CONTEXT] Using third-party PDS\'s own endpoint for token refresh:', pdsEndpoint);
          }
          
          const { accessToken: newAccessToken, refreshToken: newRefreshToken, dpopNonce: newNonce } = 
            await refreshAccessToken(refreshToken, keyPair, refreshAuthServer);
          
          // Update state
          setAccessToken(newAccessToken);
          setRefreshToken(newRefreshToken);
          if (newNonce) setDpopNonce(newNonce);
          
          // Update localStorage
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('accessToken', newAccessToken);
            localStorage.setItem('refreshToken', newRefreshToken);
            if (newNonce) localStorage.setItem('dpopNonce', newNonce);
            // Ensure we have the PDS endpoint stored consistently
            localStorage.setItem('pdsEndpoint', pdsEndpoint);
            localStorage.setItem('bsky_auth_pdsEndpoint', pdsEndpoint);
          }
          
          setLastTokenRefresh(Date.now());
          console.log('[AUTH CONTEXT] Successfully refreshed access token');
        } catch (refreshError) {
          console.error('[AUTH CONTEXT] Token refresh failed:', refreshError);
          
          // If refresh fails, we'll still try to use any nonce we received
          if (typeof localStorage !== 'undefined') {
            const latestNonce = localStorage.getItem('dpopNonce');
            if (latestNonce && latestNonce !== dpopNonce) {
              console.log('[AUTH CONTEXT] Using latest nonce from localStorage:', latestNonce);
              setDpopNonce(latestNonce);
            }
          }
        }
      } else {
        // Even if token is not expired, make sure we have the latest nonce
        if (typeof localStorage !== 'undefined') {
          const latestNonce = localStorage.getItem('dpopNonce');
          if (latestNonce && latestNonce !== dpopNonce) {
            console.log('[AUTH CONTEXT] Updating nonce from localStorage:', latestNonce);
            setDpopNonce(latestNonce);
          }
        }
      }
    } catch (error) {
      console.error('[AUTH CONTEXT] Error in checkAndRefreshToken:', error);
    }
  };

  useEffect(() => {
    // Set isClient to true once the component mounts
    setIsClient(true);
    
    // Load auth data from localStorage on initial mount
    if (typeof window !== 'undefined') {
      const storedAccessToken = localStorage.getItem('accessToken');
      const storedRefreshToken = localStorage.getItem('refreshToken');
      const storedDid = localStorage.getItem('did');
      const storedHandle = localStorage.getItem('handle');
      const storedKeyPair = localStorage.getItem('keyPair');
      const storedDpopNonce = localStorage.getItem('dpopNonce');
      
      // Special handling for PDS endpoint - check all possible storage locations
      let storedPdsEndpoint = localStorage.getItem('pdsEndpoint');
      
      // If not found, try our auth-prefixed format
      if (!storedPdsEndpoint) {
        storedPdsEndpoint = localStorage.getItem('bsky_auth_pdsEndpoint');
      }
      
      // Last resort - check sessionStorage
      if (!storedPdsEndpoint && typeof sessionStorage !== 'undefined') {
        try {
          storedPdsEndpoint = sessionStorage.getItem('pdsEndpoint');
        } catch (e) {
          console.warn('Failed to check sessionStorage for PDS endpoint:', e);
        }
      }

      if (storedAccessToken && storedDid && storedKeyPair) {
        setAccessToken(storedAccessToken);
        setRefreshToken(storedRefreshToken);
        setDid(storedDid);
        setHandle(storedHandle);
        setSerializedKeyPair(storedKeyPair);
        setDpopNonce(storedDpopNonce);
        setPdsEndpoint(storedPdsEndpoint);
        setIsAuthenticated(true);
      }
    }
  }, []);
  
  // Effect to check token expiration periodically
  useEffect(() => {
    if (!isAuthenticated) return;
    
    // Check token immediately after login
    checkAndRefreshToken();
    
    // Check token every 10 minutes
    const tokenCheckInterval = setInterval(() => {
      checkAndRefreshToken();
    }, 10 * 60 * 1000); // 10 minutes
    
    return () => clearInterval(tokenCheckInterval);
  }, [isAuthenticated, accessToken, refreshToken, serializedKeyPair, did, pdsEndpoint]);

  const setAuth = ({
    accessToken,
    refreshToken,
    did,
    handle,
    serializedKeyPair,
    dpopNonce = null,
    pdsEndpoint = null
  }: {
    accessToken: string;
    refreshToken: string;
    did: string;
    handle: string;
    serializedKeyPair: string;
    dpopNonce?: string | null;
    pdsEndpoint?: string | null;
  }) => {
    // Store auth data in state
    setAccessToken(accessToken);
    setRefreshToken(refreshToken);
    setDid(did);
    setHandle(handle);
    setSerializedKeyPair(serializedKeyPair);
    setDpopNonce(dpopNonce);
    setPdsEndpoint(pdsEndpoint);
    setIsAuthenticated(true);

    // Store auth data in localStorage (only on client)
    if (typeof window !== 'undefined') {
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      localStorage.setItem('did', did);
      localStorage.setItem('handle', handle);
      localStorage.setItem('keyPair', serializedKeyPair);
      if (dpopNonce) {
        localStorage.setItem('dpopNonce', dpopNonce);
      }
      if (pdsEndpoint) {
        localStorage.setItem('pdsEndpoint', pdsEndpoint);
      }
    }
  };

  const clearAuth = () => {
    // Clear auth data from state
    setAccessToken(null);
    setRefreshToken(null);
    setDid(null);
    setHandle(null);
    setSerializedKeyPair(null);
    setDpopNonce(null);
    setPdsEndpoint(null);
    setIsAuthenticated(false);

    // Clear auth data from localStorage (only on client)
    if (typeof window !== 'undefined') {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('did');
      localStorage.removeItem('handle');
      localStorage.removeItem('keyPair');
      localStorage.removeItem('dpopNonce');
      localStorage.removeItem('pdsEndpoint');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        accessToken,
        refreshToken,
        did,
        handle,
        serializedKeyPair,
        dpopNonce,
        pdsEndpoint,
        setAuth,
        clearAuth
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}