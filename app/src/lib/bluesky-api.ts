import { exportJWK, generateDPoPToken } from './bluesky-auth';

// Bluesky API utilities
const API_URL = 'https://bsky.social/xrpc';

// Create a custom lexicon schema for "im.flushing.right.now"
// This would normally be registered with the AT Protocol
export const FLUSHING_STATUS_NSID = 'im.flushing.right.now';

export interface FlushingRecord {
  $type: typeof FLUSHING_STATUS_NSID;
  text: string;
  emoji: string;
  createdAt: string;
}

// Make an authenticated request to the Bluesky API
export async function makeAuthenticatedRequest(
  endpoint: string,
  method: string,
  accessToken: string,
  keyPair: CryptoKeyPair,
  dpopNonce: string | null = null,
  body?: any
): Promise<any> {
  const url = `${API_URL}/${endpoint}`;
  const publicKey = await exportJWK(keyPair.publicKey);
  
  const dpopToken = await generateDPoPToken(
    keyPair.privateKey,
    publicKey,
    method,
    url,
    dpopNonce || undefined
  );
  
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

  const response = await fetch(url, requestOptions);
  
  // Handle DPoP nonce errors
  if (response.status === 401) {
    const newDpopNonce = response.headers.get('DPoP-Nonce');
    if (newDpopNonce) {
      return makeAuthenticatedRequest(endpoint, method, accessToken, keyPair, newDpopNonce, body);
    }
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API request failed: ${response.status} ${response.statusText}, ${errorText}`);
  }

  // If response is empty or not JSON, return null
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    return null;
  }

  return await response.json();
}

// Get the user profile
export async function getProfile(
  accessToken: string,
  keyPair: CryptoKeyPair,
  dpopNonce: string | null = null
): Promise<any> {
  return makeAuthenticatedRequest('com.atproto.identity.resolveHandle', 'GET', accessToken, keyPair, dpopNonce);
}

// Create a flushing status record
export async function createFlushingStatus(
  accessToken: string,
  keyPair: CryptoKeyPair,
  did: string,
  text: string,
  emoji: string,
  dpopNonce: string | null = null
): Promise<any> {
  const record: FlushingRecord = {
    $type: FLUSHING_STATUS_NSID,
    text,
    emoji,
    createdAt: new Date().toISOString()
  };

  const body = {
    repo: did,
    collection: FLUSHING_STATUS_NSID,
    record
  };

  return makeAuthenticatedRequest('com.atproto.repo.createRecord', 'POST', accessToken, keyPair, dpopNonce, body);
}