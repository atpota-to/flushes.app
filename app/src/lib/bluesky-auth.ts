// Default Bluesky OAuth client configuration
const DEFAULT_AUTH_SERVER = 'https://bsky.social';
const REDIRECT_URI = 'https://flushes.app/auth/callback';
const CLIENT_ID = 'https://flushes.app/client-metadata.json';
// Need to include transition:generic to be able to create records
const SCOPES = 'atproto transition:generic';

// Type definitions for handle resolution
interface DidDocument {
  id: string;
  // Support both formats of service definitions
  service?: Array<{
    id: string;
    type: string;
    serviceEndpoint: string;
  }>;
  services?: {
    atproto_pds?: {
      type: string;
      endpoint: string;
    };
    [key: string]: {
      type: string;
      endpoint: string;
    } | undefined;
  };
  alsoKnownAs?: string[];
}

// Function to resolve a handle to a DID document
export async function resolveHandleToDid(handle: string): Promise<{ 
  did: string; 
  pdsEndpoint: string | null; 
  hostname: string | null;
}> {
  try {
    // First, check if handle already is a DID
    if (handle.startsWith('did:')) {
      return await fetchDidDocument(handle);
    }
    
    // If not a DID, resolve the handle to a DID
    const resolveResponse = await fetch(`https://api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`);
    
    if (!resolveResponse.ok) {
      throw new Error(`Failed to resolve handle: ${resolveResponse.status}`);
    }
    
    const resolveData = await resolveResponse.json();
    const did = resolveData.did;
    
    // Now get the DID document to find the PDS endpoint
    return await fetchDidDocument(did);
  } catch (error) {
    console.error('Error resolving handle:', error);
    throw new Error(`Failed to resolve handle. Please ensure it's valid.`);
  }
}

// Function to fetch a DID document and extract PDS endpoint
async function fetchDidDocument(did: string): Promise<{ 
  did: string; 
  pdsEndpoint: string | null; 
  hostname: string | null;
}> {
  try {
    const response = await fetch(`https://plc.directory/${did}/data`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch DID document: ${response.status}`);
    }
    
    const didDoc: DidDocument = await response.json();
    
    // Find the PDS service endpoint - handle both formats
    let pdsEndpoint = null;
    
    // First try the services format (newer format)
    if (didDoc.services?.atproto_pds) {
      pdsEndpoint = didDoc.services.atproto_pds.endpoint;
    } 
    // Or try any service with AtprotoPersonalDataServer type
    else if (didDoc.services) {
      const serviceKey = Object.keys(didDoc.services).find(key => 
        didDoc.services?.[key]?.type === 'AtprotoPersonalDataServer'
      );
      if (serviceKey && didDoc.services[serviceKey]) {
        pdsEndpoint = didDoc.services[serviceKey]?.endpoint || null;
      }
    }
    // Fall back to the older service array format
    else if (didDoc.service) {
      const pdsService = didDoc.service.find(s => 
        s.type === 'AtprotoPersonalDataServer' || 
        s.id === '#atproto_pds'
      );
      pdsEndpoint = pdsService?.serviceEndpoint || null;
    }
    let hostname = null;
    
    // Extract hostname from the PDS endpoint
    if (pdsEndpoint) {
      try {
        const url = new URL(pdsEndpoint);
        hostname = url.hostname;
      } catch (e) {
        console.error('Error parsing PDS endpoint URL:', e);
      }
    }
    
    return {
      did,
      pdsEndpoint,
      hostname
    };
  } catch (error) {
    console.error('Error fetching DID document:', error);
    return {
      did,
      pdsEndpoint: null,
      hostname: null
    };
  }
}

// Generate a random string for PKCE and state
export function generateRandomString(length: number): string {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let result = '';
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

// Generate the code challenge for PKCE
export async function generateCodeChallenge(codeVerifier: string): Promise<string> {
  // Convert string to Uint8Array
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  
  // Hash the data using SHA-256
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  
  // Convert hash buffer to base64url format
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashBase64 = btoa(String.fromCharCode.apply(null, hashArray));
  
  // Convert base64 to base64url by replacing characters
  return hashBase64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// Generate a DPoP JWK key pair
export async function generateDPoPKeyPair(): Promise<CryptoKeyPair> {
  return await window.crypto.subtle.generateKey(
    {
      name: 'ECDSA',
      namedCurve: 'P-256'
    },
    true,  // extractable
    ['sign', 'verify']
  );
}

// Export the key to JWK format
export async function exportJWK(key: CryptoKey): Promise<JsonWebKey> {
  return await window.crypto.subtle.exportKey('jwk', key);
}

// Calculate the SHA-256 hash of a string
async function sha256(str: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  return await window.crypto.subtle.digest('SHA-256', data);
}

// Convert ArrayBuffer to base64url string
function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// Generate a DPoP token
export async function generateDPoPToken(
  privateKey: CryptoKey,
  publicKey: JsonWebKey,
  method: string,
  url: string,
  nonce?: string,
  accessToken?: string // Add optional access token for ath claim
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const jti = generateRandomString(16);

  const header = {
    alg: 'ES256',
    typ: 'dpop+jwt',
    jwk: publicKey
  };

  const payload: any = {
    jti,
    htm: method,
    htu: url,
    iat: now
  };

  // Add nonce if provided
  if (nonce) {
    payload.nonce = nonce;
  }
  
  // Add access token hash (ath) if access token is provided
  if (accessToken) {
    // Adding ath claim is required when using access tokens with DPoP
    const tokenHash = await sha256(accessToken);
    payload.ath = arrayBufferToBase64Url(tokenHash);
  }

  const encodedHeader = btoa(JSON.stringify(header))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const encodedPayload = btoa(JSON.stringify(payload))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const toSign = `${encodedHeader}.${encodedPayload}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(toSign);

  const signature = await window.crypto.subtle.sign(
    {
      name: 'ECDSA',
      hash: { name: 'SHA-256' },
    },
    privateKey,
    data
  );

  const signatureArray = Array.from(new Uint8Array(signature));
  const encodedSignature = btoa(String.fromCharCode.apply(null, signatureArray))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
}

// Get the authorization URL for Bluesky OAuth
export async function getAuthorizationUrl(
  pdsEndpoint?: string
): Promise<{ url: string, state: string, codeVerifier: string, keyPair: CryptoKeyPair, pdsEndpoint: string }> {
  const state = generateRandomString(32);
  const codeVerifier = generateRandomString(64);
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const keyPair = await generateDPoPKeyPair();
  const publicKey = await exportJWK(keyPair.publicKey);

  // Use the provided PDS endpoint or default to Bluesky's
  const authServer = pdsEndpoint || DEFAULT_AUTH_SERVER;
  
  // Get the service URL for OAuth (well-known endpoint)
  let authEndpoint: string;
  let metadataEndpoint: string;
  
  try {
    // Try to fetch the OAuth metadata from the PDS
    metadataEndpoint = `${authServer}/.well-known/oauth-authorization-server`;
    const parResponse = await fetch(metadataEndpoint, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!parResponse.ok) {
      // If failed, use the default path structure for OAuth
      console.warn(`Failed to fetch OAuth metadata from ${authServer}, using default paths`);
      authEndpoint = `${authServer}/oauth/authorize`;
    } else {
      // If successful, get the authorization endpoint from the metadata
      const metadata = await parResponse.json();
      authEndpoint = metadata.authorization_endpoint || `${authServer}/oauth/authorize`;
    }
  } catch (error) {
    console.error('Error fetching OAuth metadata:', error);
    // Fallback to default path structure
    authEndpoint = `${authServer}/oauth/authorize`;
  }
  
  // Build the authorization URL
  const authUrl = `${authEndpoint}` +
    `?client_id=${encodeURIComponent(CLIENT_ID)}` +
    `&response_type=code` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&scope=${encodeURIComponent(SCOPES)}` +
    `&state=${encodeURIComponent(state)}` +
    `&code_challenge=${encodeURIComponent(codeChallenge)}` +
    `&code_challenge_method=S256`;

  return {
    url: authUrl,
    state,
    codeVerifier,
    keyPair,
    pdsEndpoint: authServer
  };
}

// Helper function to get a DPoP nonce
async function getNonce(endpoint: string): Promise<string | null> {
  try {
    // Try OPTIONS first as it's less likely to have side effects
    const optionsResponse = await fetch(endpoint, {
      method: 'OPTIONS',
      headers: {
        'Accept': '*/*'
      }
    });
    
    const nonceFromOptions = optionsResponse.headers.get('DPoP-Nonce');
    if (nonceFromOptions) return nonceFromOptions;

    // If OPTIONS doesn't work, try a HEAD request
    const headResponse = await fetch(endpoint, {
      method: 'HEAD'
    });
    
    const nonceFromHead = headResponse.headers.get('DPoP-Nonce');
    if (nonceFromHead) return nonceFromHead;
    
    // As a last resort, make a "probe" POST request that will fail but might give us a nonce
    const probeResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      // Empty body - this will fail but might return a nonce
      body: new URLSearchParams({})
    });
    
    return probeResponse.headers.get('DPoP-Nonce');
  } catch (error) {
    console.error('Error getting nonce:', error);
    return null;
  }
}

// Get a nonce using our server-side API endpoint
async function fetchNonce(pdsEndpoint: string = DEFAULT_AUTH_SERVER): Promise<string | null> {
  try {
    const response = await fetch('/api/auth/nonce', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ pdsEndpoint })
    });
    
    if (!response.ok) {
      console.warn('Failed to get nonce from API');
      return null;
    }
    
    const data = await response.json();
    return data.nonce || null;
  } catch (error) {
    console.error('Error getting nonce from API:', error);
    return null;
  }
}

// Get access token from authorization code
export async function getAccessToken(
  code: string,
  codeVerifier: string,
  keyPair: CryptoKeyPair,
  pdsEndpoint: string = DEFAULT_AUTH_SERVER,
  dpopNonce?: string,
  originalPdsEndpoint?: string // Added for third-party PDS support
): Promise<any> {
  const tokenEndpoint = `${pdsEndpoint}/oauth/token`;

  // ALWAYS get a fresh nonce first if we don't have one
  if (!dpopNonce) {
    console.log('No nonce provided, getting one from API...');
    const nonce = await fetchNonce(pdsEndpoint);
    if (nonce) {
      console.log('Obtained nonce from API:', nonce);
      dpopNonce = nonce;
    } else {
      console.warn('Could not obtain a nonce, proceeding without one');
    }
  }

  console.log('Creating DPoP token with nonce:', dpopNonce);
  
  // For token requests, we don't include the ath claim as we don't have the token yet
  const publicKey = await exportJWK(keyPair.publicKey);
  const dpopToken = await generateDPoPToken(
    keyPair.privateKey,
    publicKey,
    'POST',
    tokenEndpoint,
    dpopNonce
    // No access token for token requests as we don't have it yet
  );

  console.log('Making token request via proxy API');
  
  // Use our server-side proxy to make the token request
  const proxyResponse = await fetch('/api/auth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      code,
      codeVerifier,
      dpopToken,
      pdsEndpoint,       // Auth server endpoint (usually bsky.social)
      originalPdsEndpoint // The original PDS endpoint (for third-party PDS)
    })
  });

  const responseData = await proxyResponse.json();
  
  // Check if we got a nonce error
  if (
    !proxyResponse.ok && 
    responseData.error === 'use_dpop_nonce' && 
    responseData.nonce
  ) {
    console.log('Received nonce from error response:', responseData.nonce);
    // Retry with the new nonce
    return getAccessToken(code, codeVerifier, keyPair, pdsEndpoint, responseData.nonce);
  }
  
  // Handle other errors
  if (!proxyResponse.ok) {
    console.error('Token request failed:', responseData);
    throw new Error(`Token request failed: ${proxyResponse.status}, ${JSON.stringify(responseData)}`);
  }

  console.log('Token request successful');
  
  // Return the token response
  return responseData;
}