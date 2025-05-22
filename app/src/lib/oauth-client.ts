import { BrowserOAuthClient } from '@atproto/oauth-client-browser'

// Client metadata for the OAuth client
const CLIENT_METADATA = {
  "client_id": "https://flushes.app/client-metadata.json",
  "application_type": "web" as const,
  "client_name": "Flushes",
  "client_uri": "https://flushes.app",
  "logo_uri": "https://flushes.app/logo.png",
  "tos_uri": "https://flushes.app/terms",
  "policy_uri": "https://flushes.app/privacy",
  "dpop_bound_access_tokens": true,
  "grant_types": ["authorization_code", "refresh_token"] as const,
  "redirect_uris": ["https://flushes.app/auth/callback"] as const,
  "response_types": ["code"] as const,
  "scope": "atproto transition:generic",
  "token_endpoint_auth_method": "none" as const
}

// Create the OAuth client instance
export const oauthClient = new BrowserOAuthClient({
  clientMetadata: CLIENT_METADATA as any, // Type assertion to avoid strict typing issues
  // Use Bluesky's public handle resolver
  handleResolver: 'https://bsky.social',
  // Use fragment for better SPA support
  responseMode: 'fragment'
})

// Initialize the client - this should be called once when the app loads
export async function initializeOAuthClient() {
  try {
    const result = await oauthClient.init()
    
    if (result) {
      const { session } = result
      const state = 'state' in result ? result.state : null
      console.log(`OAuth client initialized with session for ${session.sub}`)
      
      if (state) {
        console.log(`User successfully authenticated with state: ${state}`)
      } else {
        console.log(`Restored previous session`)
      }
      
      return { session, state }
    }
    
    console.log('OAuth client initialized without existing session')
    return null
  } catch (error) {
    console.error('Failed to initialize OAuth client:', error)
    throw error
  }
}

// Sign in with handle/DID
export async function signIn(handle: string, options?: {
  state?: string
  signal?: AbortSignal
}) {
  try {
    console.log(`Initiating OAuth flow for ${handle}`)
    
    await oauthClient.signIn(handle, {
      state: options?.state || `signin-${Date.now()}`,
      signal: options?.signal
    })
    
    // This will never resolve as the user gets redirected
  } catch (error) {
    console.error('OAuth sign in failed:', error)
    throw error
  }
}

// Restore a specific session by DID
export async function restoreSession(did: string) {
  try {
    console.log(`Restoring session for ${did}`)
    const session = await oauthClient.restore(did)
    console.log(`Successfully restored session for ${session.sub}`)
    return session
  } catch (error) {
    console.error(`Failed to restore session for ${did}:`, error)
    throw error
  }
}

// Sign out the current session
export async function signOut() {
  try {
    // The BrowserOAuthClient doesn't expose a direct signOut method
    // We need to manually clear the session and redirect
    // For now, we'll clear local storage and redirect
    console.log('Signing out user')
    
    // Clear any remaining localStorage items from the old implementation
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
      localStorage.removeItem('did')
      localStorage.removeItem('handle')
      localStorage.removeItem('keyPair')
      localStorage.removeItem('dpopNonce')
      localStorage.removeItem('pdsEndpoint')
      localStorage.removeItem('bsky_auth_pdsEndpoint')
    }
    
    // The OAuth client manages its own storage
    // We don't have direct access to clear it, but it will handle session cleanup
    console.log('User signed out')
  } catch (error) {
    console.error('Error during sign out:', error)
    throw error
  }
}

// Event listener for session deletion/invalidation
export function onSessionDeleted(callback: (event: { sub: string, cause: any }) => void) {
  oauthClient.addEventListener('deleted', (event: any) => {
    const { sub, cause } = event.detail
    console.error(`Session for ${sub} was invalidated:`, cause)
    callback({ sub, cause })
  })
} 