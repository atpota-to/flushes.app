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

// Lazy OAuth client - only initialize on client side
let _oauthClient: BrowserOAuthClient | null = null

// Get or create the OAuth client instance - client-side only
function getOAuthClient(): BrowserOAuthClient {
  // Ensure we're on the client side
  if (typeof window === 'undefined') {
    throw new Error('OAuth client can only be used on the client side')
  }

  if (!_oauthClient) {
    _oauthClient = new BrowserOAuthClient({
      clientMetadata: CLIENT_METADATA as any,
      handleResolver: 'https://bsky.social',
      responseMode: 'fragment'
    })
  }

  return _oauthClient
}

// Export the getter function instead of the instance
export const oauthClient = {
  get instance() {
    return getOAuthClient()
  }
}

// Initialize the client - this should be called once when the app loads
export async function initializeOAuthClient() {
  // Only run on client side
  if (typeof window === 'undefined') {
    console.log('Skipping OAuth client initialization on server side')
    return null
  }

  try {
    const client = getOAuthClient()
    const result = await client.init()
    
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
  // Only run on client side
  if (typeof window === 'undefined') {
    throw new Error('Sign in can only be called on the client side')
  }

  try {
    console.log(`Initiating OAuth flow for ${handle}`)
    
    const client = getOAuthClient()
    await client.signIn(handle, {
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
  // Only run on client side
  if (typeof window === 'undefined') {
    throw new Error('Restore session can only be called on the client side')
  }

  try {
    console.log(`Restoring session for ${did}`)
    const client = getOAuthClient()
    const session = await client.restore(did)
    console.log(`Successfully restored session for ${session.sub}`)
    return session
  } catch (error) {
    console.error(`Failed to restore session for ${did}:`, error)
    throw error
  }
}

// Sign out the current session
export async function signOut() {
  // Only run on client side
  if (typeof window === 'undefined') {
    throw new Error('Sign out can only be called on the client side')
  }

  try {
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
  // Only run on client side
  if (typeof window === 'undefined') {
    console.log('Skipping session deleted listener setup on server side')
    return
  }

  try {
    const client = getOAuthClient()
    client.addEventListener('deleted', (event: any) => {
      const { sub, cause } = event.detail
      console.error(`Session for ${sub} was invalidated:`, cause)
      callback({ sub, cause })
    })
  } catch (error) {
    console.error('Failed to set up session deleted listener:', error)
  }
} 