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
  setAuth: (auth: {
    accessToken: string;
    refreshToken: string;
    did: string;
    handle: string;
    serializedKeyPair: string;
    dpopNonce?: string | null;
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
  const [isClient, setIsClient] = useState(false);

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

      if (storedAccessToken && storedDid && storedKeyPair) {
        setAccessToken(storedAccessToken);
        setRefreshToken(storedRefreshToken);
        setDid(storedDid);
        setHandle(storedHandle);
        setSerializedKeyPair(storedKeyPair);
        setDpopNonce(storedDpopNonce);
        setIsAuthenticated(true);
      }
    }
  }, []);

  const setAuth = ({
    accessToken,
    refreshToken,
    did,
    handle,
    serializedKeyPair,
    dpopNonce = null
  }: {
    accessToken: string;
    refreshToken: string;
    did: string;
    handle: string;
    serializedKeyPair: string;
    dpopNonce?: string | null;
  }) => {
    // Store auth data in state
    setAccessToken(accessToken);
    setRefreshToken(refreshToken);
    setDid(did);
    setHandle(handle);
    setSerializedKeyPair(serializedKeyPair);
    setDpopNonce(dpopNonce);
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
    setIsAuthenticated(false);

    // Clear auth data from localStorage (only on client)
    if (typeof window !== 'undefined') {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('did');
      localStorage.removeItem('handle');
      localStorage.removeItem('keyPair');
      localStorage.removeItem('dpopNonce');
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