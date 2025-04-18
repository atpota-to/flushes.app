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
      // TEMPORARILY DISABLED TOKEN REFRESH
      // This fixes issues with third-party PDSs like geese.blue
      console.log('[AUTH CONTEXT] Token refresh temporarily disabled for third-party PDS compatibility');
      
      // Still update the nonce from localStorage if available
      if (typeof localStorage !== 'undefined') {
        const latestNonce = localStorage.getItem('dpopNonce');
        if (latestNonce && latestNonce !== dpopNonce) {
          console.log('[AUTH CONTEXT] Updating nonce from localStorage:', latestNonce);
          setDpopNonce(latestNonce);
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