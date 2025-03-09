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
  did: string,  // Add DID parameter
  dpopNonce: string | null = null,
  pdsEndpoint: string | null = null
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
    
    console.log('Checking auth with PDS endpoint:', pdsEndpoint);
    
    // Use the PDS endpoint for auth check
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
      const nonce = response.headers.get('DPoP-Nonce');
      if (nonce) {
        console.log('Got nonce during auth check:', nonce);
        // Try again with the nonce, but prevent infinite recursion
        return checkAuth(accessToken, keyPair, did, nonce, pdsEndpoint);
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
  retryCount: number = 0 // Add retry counter
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