import { exportJWK, generateDPoPToken } from './bluesky-auth';

// Bluesky API utilities
const DEFAULT_API_URL = 'https://bsky.social/xrpc';

// Create a custom lexicon schema for "im.flushing.right.now"
// This would normally be registered with the AT Protocol
export const FLUSHING_STATUS_NSID = 'im.flushing.right.now';

export interface FlushingRecord {
  $type: typeof FLUSHING_STATUS_NSID;
  text: string;
  emoji: string;
  createdAt: string;
}

// Check if a JWT token is expired
export function isTokenExpired(token: string): boolean {
  try {
    // Extract the payload from the JWT token
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.error('Invalid token format');
      return true; // Assume expired if format is invalid
    }
    
    // Decode the payload
    const payload = JSON.parse(atob(parts[1]));
    
    // Check if the token has an expiration time
    if (!payload.exp) {
      console.warn('Token does not have an expiration time');
      return false; // Can't determine if it's expired
    }
    
    // Check if the token is expired
    const now = Math.floor(Date.now() / 1000);
    const isExpired = payload.exp <= now;
    
    if (isExpired) {
      console.log(`Token expired at ${new Date(payload.exp * 1000).toISOString()}`);
    }
    
    // We also want to proactively refresh tokens that will expire soon (within 5 minutes)
    const expiresInSeconds = payload.exp - now;
    const isExpiringSoon = expiresInSeconds > 0 && expiresInSeconds < 300; // 5 minutes
    
    if (isExpiringSoon) {
      console.log(`Token will expire soon: ${expiresInSeconds} seconds remaining`);
    }
    
    return isExpired || isExpiringSoon;
  } catch (error) {
    console.error('Error checking token expiration:', error);
    return true; // Assume expired if there's an error
  }
}

// Refresh an access token using the refresh token
export async function refreshAccessToken(
  refreshToken: string,
  keyPair: CryptoKeyPair,
  pdsEndpoint: string
): Promise<{ 
  accessToken: string; 
  refreshToken: string;
  dpopNonce?: string;
}> {
  try {
    if (!pdsEndpoint) {
      throw new Error('No PDS endpoint provided for token refresh');
    }
    
    console.log('[TOKEN REFRESH] Refreshing token for PDS:', pdsEndpoint);
    
    // CRITICAL FIX: Token refresh endpoint selection based on PDS type
    let authServer = pdsEndpoint;
    
    // For bsky.network PDSes, use bsky.social
    if (pdsEndpoint.includes('bsky.network')) {
      console.log('[TOKEN REFRESH] Using bsky.social for bsky.network PDS');
      authServer = 'https://bsky.social';
    } else if (pdsEndpoint.includes('bsky.social')) {
      // Already using bsky.social
      console.log('[TOKEN REFRESH] Using bsky.social directly');
    } else {
      // For third-party PDSes, use their own endpoint for token refresh
      console.log('[TOKEN REFRESH] Using third-party PDS\'s own endpoint for token refresh:', pdsEndpoint);
      // Keep authServer as the original PDS endpoint
    }
    
    // Endpoint for token refresh
    const tokenEndpoint = `${authServer}/oauth/token`;
    
    // For third-party PDS, directly get nonce from PDS endpoint
    // This is critical because third-party PDSes need their own specific nonce
    let dpopNonce = null;
    
    // Special handling for third-party PDS token refresh
    if (!authServer.includes('bsky.social') && !authServer.includes('bsky.network')) {
      try {
        // For third-party PDS, use a two-step approach to get the valid nonce:
        console.log('[TOKEN REFRESH] Direct nonce retrieval from third-party PDS');
        
        // Step 1: Send an empty token refresh request to get a nonce error
        // This ensures we get the exact format of nonce the PDS expects
        console.log('[TOKEN REFRESH] Step 1: Sending probe request to get nonce');
        const probeResponse = await fetch(tokenEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            'grant_type': 'refresh_token',
            'refresh_token': refreshToken,
            'client_id': 'https://flushes.app/client-metadata.json'
          })
        });
        
        // Get the nonce from the error response
        const probeNonce = probeResponse.headers.get('DPoP-Nonce');
        if (probeNonce) {
          console.log('[TOKEN REFRESH] Got DPoP-Nonce from probe response:', probeNonce);
          dpopNonce = probeNonce;
        } else {
          // Try to parse the response body for a nonce in the error message
          try {
            const probeData = await probeResponse.json();
            if (probeData.error === 'use_dpop_nonce' && probeData.nonce) {
              console.log('[TOKEN REFRESH] Got nonce from error body:', probeData.nonce);
              dpopNonce = probeData.nonce;
            }
          } catch (e) {
            console.warn('[TOKEN REFRESH] Failed to parse probe response:', e);
          }
        }
      } catch (directError) {
        console.warn('[TOKEN REFRESH] Direct nonce retrieval failed:', directError);
      }
    }
    
    // Fall back to standard nonce retrieval methods if direct method failed
    if (!dpopNonce) {
      try {
        // Try server-side nonce retrieval first
        console.log('[TOKEN REFRESH] Getting fresh nonce from server API');
        const nonceResponse = await fetch('/api/auth/nonce', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pdsEndpoint: authServer }) // Use the correct server
        });
        
        if (nonceResponse.ok) {
          const nonceData = await nonceResponse.json();
          if (nonceData.nonce) {
            dpopNonce = nonceData.nonce;
            console.log('[TOKEN REFRESH] Got fresh nonce from server API:', dpopNonce);
          }
        }
        
        // If server-side retrieval fails, try client-side
        if (!dpopNonce) {
          console.log('[TOKEN REFRESH] Trying HEAD request for nonce');
          const headResponse = await fetch(tokenEndpoint, { method: 'HEAD' });
          dpopNonce = headResponse.headers.get('DPoP-Nonce');
        }
        
        // If still no nonce, try POST probe
        if (!dpopNonce) {
          console.log('[TOKEN REFRESH] Trying POST probe for nonce');
          const probeResponse = await fetch(tokenEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({})  // Empty body to trigger error response with nonce
          });
          dpopNonce = probeResponse.headers.get('DPoP-Nonce');
        }
      } catch (nonceError) {
        console.warn('[TOKEN REFRESH] Failed to get initial nonce:', nonceError);
      }
    }
    
    if (!dpopNonce) {
      console.log('[TOKEN REFRESH] No nonce obtained, proceeding without one');
    } else {
      console.log('[TOKEN REFRESH] Obtained nonce:', dpopNonce);
    }
    
    // Generate DPoP token for the refresh request
    const publicKey = await exportJWK(keyPair.publicKey);
    const dpopToken = await generateDPoPToken(
      keyPair.privateKey,
      publicKey,
      'POST',
      tokenEndpoint,
      dpopNonce || undefined
    );
    
    console.log('[TOKEN REFRESH] Making token refresh request');
    
    // Make the token refresh request
    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'DPoP': dpopToken
      },
      body: new URLSearchParams({
        'grant_type': 'refresh_token',
        'refresh_token': refreshToken,
        'client_id': 'https://flushes.app/client-metadata.json'
      })
    });
    
    // Handle nonce error explicitly - this is the critical part!
    if (response.status === 401 || response.status === 400) {
      let responseBody;
      try {
        responseBody = await response.json();
      } catch (e) {
        responseBody = {};
      }
      
      // Try to get nonce from multiple sources
      let newNonce = response.headers.get('DPoP-Nonce');
      
      // Also check for nonce in the response body (some PDSes return it there)
      if (!newNonce && responseBody.nonce) {
        newNonce = responseBody.nonce;
        console.log('[TOKEN REFRESH] Found nonce in response body:', newNonce);
      }
      
      // Some servers use DPoP-Nonce header instead of nonce in body
      if (!newNonce && response.headers.get('DPoP-Nonce')) {
        newNonce = response.headers.get('DPoP-Nonce');
        console.log('[TOKEN REFRESH] Found DPoP-Nonce in response headers:', newNonce);
      }
      
      // Check for DPoP nonce error
      const isNonceError = 
        responseBody.error === 'use_dpop_nonce' || 
        responseBody.error === 'invalid_dpop_proof' ||
        (responseBody.error_description && (
          responseBody.error_description.includes('nonce') || 
          responseBody.error_description.includes('DPoP')
        ));
      
      if (isNonceError && newNonce) {
        console.log('[TOKEN REFRESH] Received nonce error, retrying with new nonce:', newNonce);
        
        // Generate new DPoP token with the provided nonce
        const retryDpopToken = await generateDPoPToken(
          keyPair.privateKey,
          publicKey,
          'POST',
          tokenEndpoint,
          newNonce
        );
        
        console.log('[TOKEN REFRESH] Retrying token refresh with new nonce');
        
        // Retry the request with the new nonce
        const retryResponse = await fetch(tokenEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'DPoP': retryDpopToken
          },
          body: new URLSearchParams({
            'grant_type': 'refresh_token',
            'refresh_token': refreshToken,
            'client_id': 'https://flushes.app/client-metadata.json'
          })
        });
        
        if (!retryResponse.ok) {
          const errorText = await retryResponse.text();
          console.error('[TOKEN REFRESH] Token refresh retry failed:', retryResponse.status, errorText);
          throw new Error(`Token refresh retry failed: ${retryResponse.status}, ${errorText}`);
        }
        
        const tokenData = await retryResponse.json();
        console.log('[TOKEN REFRESH] Successfully refreshed token on retry');
        
        // Store the new nonce for future requests
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('dpopNonce', newNonce);
        }
        
        // Return the new tokens and nonce
        return {
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token || refreshToken,
          dpopNonce: newNonce
        };
      }
    }
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[TOKEN REFRESH] Token refresh failed:', response.status, errorText);
      throw new Error(`Token refresh failed: ${response.status}, ${errorText}`);
    }
    
    const tokenData = await response.json();
    
    // Get any nonce from the response headers
    const responseNonce = response.headers.get('DPoP-Nonce');
    
    console.log('[TOKEN REFRESH] Successfully refreshed access token');
    
    // Update the nonce in localStorage
    if (responseNonce && typeof localStorage !== 'undefined') {
      localStorage.setItem('dpopNonce', responseNonce);
    }
    
    // Return the new tokens and nonce
    return {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token || refreshToken,
      dpopNonce: responseNonce || dpopNonce
    };
  } catch (error) {
    console.error('[TOKEN REFRESH] Error refreshing access token:', error);
    throw error;
  }
}

// Check if authentication is valid by making a simple request
export async function checkAuth(
  accessToken: string,
  keyPair: CryptoKeyPair,
  did: string,
  dpopNonce: string | null = null,
  pdsEndpoint: string | null = null,
  refreshToken: string | null = null // Add refresh token parameter
): Promise<boolean> {
  try {
    if (!pdsEndpoint) {
      console.error('No PDS endpoint provided for auth check');
      return false;
    }
    
    if (!did) {
      console.error('No DID provided for auth check');
      return false;
    }
    
    // For API calls, use the actual PDS endpoint
    // But when we need to do token refresh, use bsky.social for auth on third-party servers
    let authServer = pdsEndpoint;
    if (!pdsEndpoint.includes('bsky.social')) {
      console.log('[AUTH CHECK] Will use bsky.social for OAuth on third-party PDS');
      authServer = 'https://bsky.social';
    }

    // First check if the token is expired by decoding it
    const tokenExpired = isTokenExpired(accessToken);
    if (tokenExpired && refreshToken) {
      console.log('Access token is expired, attempting to refresh...');
      
      try {
        // Try to refresh the token using bsky.social for auth on third-party PDS
        const { accessToken: newAccessToken, refreshToken: newRefreshToken, dpopNonce: newNonce } = 
          await refreshAccessToken(refreshToken, keyPair, authServer);
        
        // Update tokens in localStorage
        localStorage.setItem('accessToken', newAccessToken);
        localStorage.setItem('refreshToken', newRefreshToken);
        if (newNonce) localStorage.setItem('dpopNonce', newNonce);
        
        console.log('Tokens updated in localStorage during checkAuth');
        
        console.log('Token refreshed successfully, retrying auth check with new token');
        
        // Return the result of checkAuth with the new token
        return checkAuth(newAccessToken, keyPair, did, newNonce || null, pdsEndpoint, newRefreshToken);
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
        return false;
      }
    }
    
    console.log('Checking auth with PDS endpoint:', pdsEndpoint);
    
    // For API calls, use the actual PDS endpoint
    const baseUrl = `${pdsEndpoint}/xrpc`;
    
    // First, get the user's handle from their DID using repo.describeRepo
    const describeRepoEndpoint = `${baseUrl}/com.atproto.repo.describeRepo`;
    const describeRepoUrl = `${describeRepoEndpoint}?repo=${encodeURIComponent(did)}`;
    
    console.log(`Checking user identity with: ${describeRepoUrl}`);
    
    // We'll use repo.describeRepo first to get user info
    const url = describeRepoUrl;
    
    // Generate DPoP token with the full URL including query params
    const publicKey = await exportJWK(keyPair.publicKey);
    const dpopToken = await generateDPoPToken(
      keyPair.privateKey,
      publicKey,
      'GET',
      url,
      dpopNonce || undefined,
      accessToken // Pass the access token for ath claim
    );
    
    console.log('Making auth check request to:', url);
    
    // Make the request to check auth
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `DPoP ${accessToken}`,
        'DPoP': dpopToken
      }
    });
    
    if (response.ok) {
      console.log('Auth check successful!');
      return true;
    }
    
    // Log detailed error information
    try {
      console.error('Auth check response:', response.status, response.statusText);
      const errorData = await response.text();
      console.error('Auth check error data:', errorData);
    } catch (parseError) {
      console.error('Could not parse error response:', parseError);
    }
    
    if (response.status === 401) {
      // Try to parse error response
      let responseBody;
      try {
        responseBody = await response.json();
      } catch (e) {
        responseBody = {};
      }
      
      const nonce = response.headers.get('DPoP-Nonce');
      if (nonce) {
        console.log('[AUTH CHECK] Got nonce during auth check:', nonce);
        
        // Store the nonce for future use
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('dpopNonce', nonce);
        }
        
        // Check if this is a nonce error
        if (responseBody.error === 'use_dpop_nonce' || 
            (responseBody.error_description && responseBody.error_description.includes('nonce'))) {
          console.log('[AUTH CHECK] DPoP nonce error detected, retrying with new nonce');
        }
        
        // Try again with the nonce, but prevent infinite recursion
        return checkAuth(accessToken, keyPair, did, nonce, pdsEndpoint, refreshToken);
      }
      
      // If we have a refresh token, try to refresh the access token
      if (refreshToken && !tokenExpired) { // Only try this if we didn't already try above
        console.log('[AUTH CHECK] Auth failed with 401, attempting to refresh token...');
        
        try {
          // Try to refresh the token with enhanced error handling
          // Follow the same server selection logic as in refreshAccessToken
          let refreshAuthServer = pdsEndpoint;
          
          // For bsky.network PDSes, use bsky.social
          if (pdsEndpoint.includes('bsky.network')) {
            console.log('[AUTH CHECK] Will use bsky.social for bsky.network PDS');
            refreshAuthServer = 'https://bsky.social';
          } else if (pdsEndpoint.includes('bsky.social')) {
            // Already using bsky.social
            console.log('[AUTH CHECK] Will use bsky.social directly');
          } else {
            // For third-party PDSes, use their own endpoint
            console.log('[AUTH CHECK] Will use third-party PDS\'s own endpoint:', pdsEndpoint);
            // Keep refreshAuthServer as the original PDS endpoint
            
            // Ensure we update the PDS endpoint everywhere
            if (typeof localStorage !== 'undefined') {
              localStorage.setItem('pdsEndpoint', pdsEndpoint);
              localStorage.setItem('bsky_auth_pdsEndpoint', pdsEndpoint);
            }
          }
          
          const { accessToken: newAccessToken, refreshToken: newRefreshToken, dpopNonce: newNonce } = 
            await refreshAccessToken(refreshToken, keyPair, refreshAuthServer);
          
          // Update tokens in localStorage
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('accessToken', newAccessToken);
            localStorage.setItem('refreshToken', newRefreshToken);
            if (newNonce) localStorage.setItem('dpopNonce', newNonce);
            
            console.log('[AUTH CHECK] Tokens updated in localStorage during checkAuth');
          }
          
          console.log('[AUTH CHECK] Token refreshed successfully, retrying auth check with new token');
          
          // Return the result of checkAuth with the new token
          return checkAuth(newAccessToken, keyPair, did, newNonce || null, pdsEndpoint, newRefreshToken);
        } catch (refreshError) {
          console.error('[AUTH CHECK] Token refresh failed:', refreshError);
          console.log('[AUTH CHECK] User needs to re-authenticate - session cannot be restored');
        }
      }
    }
    
    console.error('Auth check failed with status:', response.status);
    return false;
  } catch (error) {
    console.error('Error checking auth:', error);
    return false;
  }
}

// Make an authenticated request to the Bluesky API
export async function makeAuthenticatedRequest(
  endpoint: string,
  method: string,
  accessToken: string,
  keyPair: CryptoKeyPair,
  dpopNonce: string | null = null,
  body?: any,
  pdsEndpoint: string | null = null
): Promise<any> {
  // Use the PDS endpoint if provided, otherwise fall back to default
  const baseUrl = pdsEndpoint ? `${pdsEndpoint}/xrpc` : DEFAULT_API_URL;
  const url = `${baseUrl}/${endpoint}`;
  
  console.log(`Making ${method} request to ${url} (PDS: ${pdsEndpoint || 'default'})`);
  
  // If no nonce is provided, try to get one first
  if (!dpopNonce) {
    try {
      // Make a HEAD request to get a nonce
      const headResponse = await fetch(url, {
        method: 'HEAD'
      });
      
      const nonce = headResponse.headers.get('DPoP-Nonce');
      if (nonce) {
        return makeAuthenticatedRequest(endpoint, method, accessToken, keyPair, nonce, body, pdsEndpoint);
      }
    } catch (err) {
      console.warn('Failed to get nonce via HEAD request, continuing without it', err);
    }
  }
  
  // Generate the DPoP token
  const publicKey = await exportJWK(keyPair.publicKey);
  const dpopToken = await generateDPoPToken(
    keyPair.privateKey,
    publicKey,
    method,
    url,
    dpopNonce || undefined
  );
  
  // Set headers
  const headers: HeadersInit = {
    'Authorization': `DPoP ${accessToken}`,
    'DPoP': dpopToken,
    'Content-Type': 'application/json'
  };

  const requestOptions: RequestInit = {
    method,
    headers
  };

  if (body) {
    requestOptions.body = JSON.stringify(body);
  }

  // Make the request
  const response = await fetch(url, requestOptions);
  
  // Handle DPoP nonce errors or other 401 errors
  if (response.status === 401) {
    // Try to parse error response
    let responseBody;
    try {
      responseBody = await response.json();
    } catch (e) {
      responseBody = {};
    }
    
    // Get the nonce from headers if available
    const newDpopNonce = response.headers.get('DPoP-Nonce');
    
    // Check if this is a nonce error
    if (
      (responseBody.error === 'use_dpop_nonce' || 
      (responseBody.error_description && responseBody.error_description.includes('nonce'))) &&
      newDpopNonce
    ) {
      // Store the nonce for future use
      if (typeof localStorage !== 'undefined') {
        console.log('[API REQUEST] Storing new DPoP nonce in localStorage:', newDpopNonce);
        localStorage.setItem('dpopNonce', newDpopNonce);
      }
      
      console.log('[API REQUEST] Retrying request with new nonce:', newDpopNonce);
      return makeAuthenticatedRequest(endpoint, method, accessToken, keyPair, newDpopNonce, body, pdsEndpoint);
    }
    
    // Other 401 error, possibly expired token
    console.error('[API REQUEST] Request failed with 401 unauthorized:', responseBody);
    
    // Include nonce in error message if available
    if (newDpopNonce) {
      console.log('[API REQUEST] 401 response included nonce:', newDpopNonce);
      // Store the nonce even though we're not retrying now
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('dpopNonce', newDpopNonce);
      }
    }
    
    throw new Error(`API request unauthorized: ${JSON.stringify(responseBody)}`);
  }

  // Handle other errors
  if (!response.ok) {
    let errorText;
    try {
      const errorJson = await response.json();
      errorText = JSON.stringify(errorJson);
    } catch {
      errorText = await response.text();
    }
    throw new Error(`API request failed: ${response.status}, ${errorText}`);
  }

  // Parse JSON response if present
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    return null;
  }

  const result = await response.json();
  
  // Save any nonce for future requests
  const returnNonce = response.headers.get('DPoP-Nonce');
  if (returnNonce && returnNonce !== dpopNonce) {
    console.log('[API REQUEST] New DPoP nonce received in successful response:', returnNonce);
    
    // Always store the latest nonce for future requests
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('dpopNonce', returnNonce);
      console.log('[API REQUEST] Updated nonce in localStorage for future requests');
    }
  }
  
  return result;
}

// Get the user profile
export async function getProfile(
  accessToken: string,
  keyPair: CryptoKeyPair,
  dpopNonce: string | null = null,
  handle: string = '', // Optional handle to resolve
  pdsEndpoint: string | null = null
): Promise<any> {
  try {
    // Generate a DPoP token for the profile request
    const publicKey = await exportJWK(keyPair.publicKey);
    
    // Use the PDS endpoint if available
    const baseUrl = pdsEndpoint ? `${pdsEndpoint}/xrpc` : 'https://bsky.social/xrpc';
    
    // Step 1: If we have a DID, we want to get both the user's DID and handle
    let endpoint;
    let isDid = handle && handle.startsWith('did:');
    
    // First try to get the user's handle from the DID using PLC directory
    if (isDid) {
      try {
        const plcResponse = await fetch(`https://plc.directory/${handle}/data`);
        
        if (plcResponse.ok) {
          const plcData = await plcResponse.json();
          if (plcData.alsoKnownAs && plcData.alsoKnownAs.length > 0) {
            const handleUrl = plcData.alsoKnownAs[0];
            if (handleUrl.startsWith('at://')) {
              // We found the handle!
              const userHandle = handleUrl.substring(5); // Remove 'at://'
              console.log(`PLC directory resolved DID ${handle} to handle ${userHandle}`);
              
              // Return it immediately
              return { did: handle, handle: userHandle };
            }
          }
        }
      } catch (plcError) {
        console.warn('Failed to resolve handle from PLC directory:', plcError);
      }
      
      // If we get here, we need to use describeRepo to get user info
      endpoint = `${baseUrl}/com.atproto.repo.describeRepo?repo=${encodeURIComponent(handle)}`;
      console.log(`Using describeRepo for DID ${handle} at ${endpoint}`);
    } 
    // If we have a handle but no DID, we need to resolve the handle to a DID
    else if (handle) {
      endpoint = `${baseUrl}/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`;
      console.log(`Using resolveHandle for handle ${handle} at ${endpoint}`);
    }
    // If we have neither, we'll try to get the user's own info
    else {
      // Try to get the user's own repo info - note this only works on some PDS servers
      endpoint = `${baseUrl}/com.atproto.repo.describeRepo`;
      console.log(`Using describeRepo without params at ${endpoint}`);
    }
    
    // Generate the DPoP token with the access token for the ath claim
    const dpopToken = await generateDPoPToken(
      keyPair.privateKey, 
      publicKey, 
      'GET', 
      endpoint, 
      dpopNonce || undefined,
      accessToken // Include access token for ath claim
    );
    
    // Make the request via our proxy API
    const response = await fetch('/api/bluesky/profile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        accessToken,
        dpopToken,
        handle,  // Include the handle in the request
        pdsEndpoint // Include the PDS endpoint
      })
    });
    
    // Even if the response isn't OK, we'll try to parse it
    const responseData = await response.json();
    
    if (!response.ok) {
      console.error('Profile fetch error:', responseData);
      // Return a basic profile if we got an error
      return { did: responseData.did || 'unknown_did', handle: responseData.handle || 'unknown' };
    }
    
    console.log('Profile data from API:', responseData);
    return responseData;
  } catch (error) {
    console.error('Error resolving handle:', error);
    // If we fail to get the profile, return a basic object to avoid breaking the flow
    // The user can still use the app and we'll use the DID as the identifier
    return { handle: 'unknown' };
  }
}

// Create a flushing status record
export async function createFlushingStatus(
  accessToken: string,
  keyPair: CryptoKeyPair,
  did: string,
  text: string,
  emoji: string,
  dpopNonce: string | null = null,
  pdsEndpoint: string | null = null,
  retryCount: number = 0, // Add retry counter
  refreshToken: string | null = null // Add refresh token parameter
): Promise<any> {
  // Safety check: prevent infinite recursion
  if (retryCount >= 3) {
    throw new Error('Maximum retry attempts reached. Could not create status after 3 attempts.');
  }
  
  // Preparing to create status record (attempt ${retryCount + 1})
  
  try {
    // Validate inputs
    if (!accessToken) throw new Error('Access token is required');
    if (!did) throw new Error('DID is required');
    if (!emoji) throw new Error('Emoji is required');
    
    // Format text to ensure it starts with "is"
    let statusText = text ? text.trim() : '';
    
    // If text is empty, use default "is flushing"
    if (!statusText) {
      statusText = "is flushing";
    } 
    // If text doesn't start with "is", add it
    else if (!statusText.toLowerCase().startsWith("is ")) {
      statusText = `is ${statusText}`;
    }
    
    // Use the PDS endpoint if available
    if (!pdsEndpoint) {
      console.error('Missing PDS endpoint. This will likely fail.');
    }
    
    const baseUrl = pdsEndpoint ? `${pdsEndpoint}/xrpc` : 'https://bsky.social/xrpc';
    const endpoint = `${baseUrl}/com.atproto.repo.createRecord`;
    
    // Endpoint is set
    
    // Generate a DPoP token for the create request
    const publicKey = await exportJWK(keyPair.publicKey);
    
    // Generate token with appropriate claims for the request
    
    const dpopToken = await generateDPoPToken(
      keyPair.privateKey, 
      publicKey, 
      'POST', 
      endpoint, 
      dpopNonce || undefined,
      accessToken // Pass the access token for ath claim
    );
    
    // Make the request via our proxy API
    // Sending request
    const response = await fetch('/api/bluesky/flushing', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        accessToken,
        dpopToken,
        did,
        text: statusText, // Use statusText which includes default if needed
        emoji,
        pdsEndpoint // Include the PDS endpoint
      })
    });
    
    // Handle response
    if (response.ok) {
      return await response.json();
    }
    
    const errorData = await response.json().catch(() => ({}));
    
    // Handle nonce error with retry
    if (response.status === 401 && errorData.error === 'use_dpop_nonce' && errorData.nonce) {
      // This is normal operation - DPoP requires a nonce exchange
      console.log('Received nonce from server, retrying request');
      
      // Retry with the new nonce and increment retry counter
      return createFlushingStatus(
        accessToken,
        keyPair,
        did,
        statusText, // Use statusText which includes default if needed
        emoji,
        errorData.nonce,
        pdsEndpoint,
        retryCount + 1,
        refreshToken // Pass through the refresh token
      );
    }
    
    // Handle expired token with refresh
    if (response.status === 401 && refreshToken) {
      console.log('Authentication error (401), attempting token refresh...');
      
      try {
        // CRITICAL FIX: Follow the same server selection logic as in refreshAccessToken
        let refreshAuthServer = pdsEndpoint || 'https://bsky.social';
        
        // For bsky.network PDSes, use bsky.social
        if (refreshAuthServer.includes('bsky.network')) {
          console.log('[CREATE STATUS] Using bsky.social for token refresh with bsky.network PDS');
          refreshAuthServer = 'https://bsky.social';
        } else if (refreshAuthServer.includes('bsky.social')) {
          // Already using bsky.social
          console.log('[CREATE STATUS] Using bsky.social directly for token refresh');
        } else {
          // For third-party PDSes, use their own endpoint
          console.log('[CREATE STATUS] Using third-party PDS\'s own endpoint for token refresh:', refreshAuthServer);
        }
        
        // Try to refresh the token
        const { accessToken: newAccessToken, refreshToken: newRefreshToken, dpopNonce: newNonce } = 
          await refreshAccessToken(refreshToken, keyPair, refreshAuthServer);
        
        // Update tokens in localStorage
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('accessToken', newAccessToken);
          localStorage.setItem('refreshToken', newRefreshToken);
          if (newNonce) localStorage.setItem('dpopNonce', newNonce);
          
          console.log('Tokens updated in localStorage during createFlushingStatus');
        }
        
        console.log('Token refreshed successfully, retrying status creation');
        
        // Retry with the new token
        return createFlushingStatus(
          newAccessToken,
          keyPair,
          did,
          statusText,
          emoji,
          newNonce || null,
          pdsEndpoint,
          retryCount + 1,
          newRefreshToken
        );
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
        throw new Error('Authentication expired. Please log out and log in again.');
      }
    }
    
    // For other errors, throw with more details
    if (errorData.message) {
      throw new Error(`Status creation failed (${response.status}): ${errorData.message}`);
    } else {
      throw new Error(`Status creation failed with status ${response.status}`);
    }
  } catch (error) {
    console.error('Error creating flushing status:', error);
    throw error;
  }
}