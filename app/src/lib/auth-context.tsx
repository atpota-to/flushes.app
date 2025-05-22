'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { OAuthSession } from '@atproto/oauth-client-browser';
import { initializeOAuthClient, oauthClient, signIn, restoreSession, signOut, onSessionDeleted } from './oauth-client';

interface AuthContextType {
  session: OAuthSession | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: (handle: string) => Promise<void>;
  signOut: () => Promise<void>;
  restoreSession: (did: string) => Promise<OAuthSession>;
  // Legacy compatibility properties for existing code
  accessToken: string | null;
  refreshToken: string | null;
  did: string | null;
  handle: string | null;
  pdsEndpoint: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<OAuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize the OAuth client on mount
  useEffect(() => {
    async function initialize() {
      try {
        setIsLoading(true);
        
        const result = await initializeOAuthClient();
        
        if (result) {
          console.log('Initialized with existing session:', result.session.sub);
          setSession(result.session);
        }
      } catch (error) {
        console.error('Failed to initialize OAuth client:', error);
      } finally {
        setIsLoading(false);
      }
    }

    initialize();
  }, []);

  // Set up session deletion listener
  useEffect(() => {
    const handleSessionDeleted = ({ sub, cause }: { sub: string; cause: any }) => {
      console.error(`Session for ${sub} was invalidated:`, cause);
      setSession(null);
    };

    onSessionDeleted(handleSessionDeleted);
  }, []);

  const handleSignIn = async (handle: string) => {
    try {
      await signIn(handle);
      // Note: This will redirect, so we won't reach this point
    } catch (error) {
      console.error('Sign in failed:', error);
      throw error;
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      setSession(null);
    } catch (error) {
      console.error('Sign out failed:', error);
      throw error;
    }
  };

  const handleRestoreSession = async (did: string) => {
    try {
      const restoredSession = await restoreSession(did);
      setSession(restoredSession);
      return restoredSession;
    } catch (error) {
      console.error('Failed to restore session:', error);
      throw error;
    }
  };

  const contextValue: AuthContextType = {
    session,
    isAuthenticated: !!session,
    isLoading,
    signIn: handleSignIn,
    signOut: handleSignOut,
    restoreSession: handleRestoreSession,
    // Legacy compatibility - provide basic properties
    accessToken: session ? 'available' : null, // Session manages tokens internally
    refreshToken: session ? 'available' : null, // Session manages tokens internally
    did: session?.sub || null,
    handle: null, // Will be fetched by components when needed
    pdsEndpoint: null // Not exposed by the new OAuth client
  };

  return (
    <AuthContext.Provider value={contextValue}>
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