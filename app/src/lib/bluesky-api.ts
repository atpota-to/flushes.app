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

// Check if authentication is valid by making a simple request
export async function checkAuth(
  accessToken: string,
  keyPair: CryptoKeyPair,
  dpopNonce: string | null = null,
  pdsEndpoint: string | null = null
): Promise<boolean> {
  try {
    if (!pdsEndpoint) {
      console.error('No PDS endpoint provided for auth check');
      return false;
    }
    
    console.log('Checking auth with PDS endpoint:', pdsEndpoint);
    
    // Use the PDS endpoint for auth check
    const baseUrl = `${pdsEndpoint}/xrpc`;
    const endpoint = `${baseUrl}/com.atproto.repo.listRecords`;
    
    // Generate DPoP token
    const publicKey = await exportJWK(keyPair.publicKey);
    const dpopToken = await generateDPoPToken(
      keyPair.privateKey,
      publicKey,
      'GET',
      `${endpoint}?limit=1`,
      dpopNonce || undefined
    );
    
    // Make the request to check auth
    const response = await fetch(`${endpoint}?limit=1`, {
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
    
    if (response.status === 401) {
      const nonce = response.headers.get('DPoP-Nonce');
      if (nonce) {
        console.log('Got nonce during auth check:', nonce);
        // Try again with the nonce
        return checkAuth(accessToken, keyPair, nonce, pdsEndpoint);
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
  
  console.log(`Making ${method} request to ${url}`);
  
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
    
    // Check if this is a nonce error
    if (
      responseBody.error === 'use_dpop_nonce' || 
      (responseBody.error_description && responseBody.error_description.includes('nonce'))
    ) {
      // Get new nonce from header
      const newDpopNonce = response.headers.get('DPoP-Nonce');
      if (newDpopNonce) {
        console.log('Retrying API request with nonce:', newDpopNonce);
        return makeAuthenticatedRequest(endpoint, method, accessToken, keyPair, newDpopNonce, body);
      }
    }
    
    // Other 401 error, possibly expired token
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
    // If there's a place to store it, we would store it here
    console.log('New DPoP nonce received:', returnNonce);
  }
  
  return result;
}

// Get the user profile
export async function getProfile(
  accessToken: string,
  keyPair: CryptoKeyPair,
  dpopNonce: string | null = null,
  handle: string = 'atproto.com', // Default handle to resolve
  pdsEndpoint: string | null = null
): Promise<any> {
  try {
    console.log('Getting profile via proxy API');
    
    // Generate a DPoP token for the profile request
    const publicKey = await exportJWK(keyPair.publicKey);
    // Use the PDS endpoint if available
    const baseUrl = pdsEndpoint ? `${pdsEndpoint}/xrpc` : 'https://bsky.social/xrpc';
    // Include the handle parameter in the URL for token creation
    const endpoint = `${baseUrl}/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`;
    const dpopToken = await generateDPoPToken(
      keyPair.privateKey, 
      publicKey, 
      'GET', 
      endpoint, 
      dpopNonce || undefined
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
  retryCount: number = 0 // Add retry counter
): Promise<any> {
  // Safety check: prevent infinite recursion
  if (retryCount >= 3) {
    throw new Error('Maximum retry attempts reached. Could not create status after 3 attempts.');
  }
  
  console.log(`Creating flushing status (attempt ${retryCount + 1}/3) with nonce:`, dpopNonce);
  console.log('Using PDS endpoint:', pdsEndpoint || 'default');
  
  try {
    // Validate inputs
    if (!accessToken) throw new Error('Access token is required');
    if (!did) throw new Error('DID is required');
    if (!text) throw new Error('Text is required');
    if (!emoji) throw new Error('Emoji is required');
    
    // Use the PDS endpoint if available
    if (!pdsEndpoint) {
      console.error('Missing PDS endpoint. This will likely fail.');
    }
    
    const baseUrl = pdsEndpoint ? `${pdsEndpoint}/xrpc` : 'https://bsky.social/xrpc';
    const endpoint = `${baseUrl}/com.atproto.repo.createRecord`;
    
    console.log('API endpoint:', endpoint);
    
    // Generate a DPoP token for the create request
    const publicKey = await exportJWK(keyPair.publicKey);
    
    console.log('Generating DPoP token for:', endpoint, 'with nonce:', dpopNonce || 'none');
    
    const dpopToken = await generateDPoPToken(
      keyPair.privateKey, 
      publicKey, 
      'POST', 
      endpoint, 
      dpopNonce || undefined
    );
    
    // Make the request via our proxy API
    console.log('Sending request to proxy API...');
    const response = await fetch('/api/bluesky/flushing', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        accessToken,
        dpopToken,
        did,
        text,
        emoji,
        pdsEndpoint // Include the PDS endpoint
      })
    });
    
    // Handle response
    if (response.ok) {
      console.log('Status update successful!');
      return await response.json();
    }
    
    const errorData = await response.json().catch(() => ({}));
    console.error('Status creation error:', errorData);
    
    // Handle nonce error with retry
    if (response.status === 401 && errorData.error === 'use_dpop_nonce' && errorData.nonce) {
      console.log('Received DPoP nonce error, retrying with nonce:', errorData.nonce);
      
      // Retry with the new nonce and increment retry counter
      return createFlushingStatus(
        accessToken,
        keyPair,
        did,
        text, 
        emoji,
        errorData.nonce,
        pdsEndpoint,
        retryCount + 1
      );
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