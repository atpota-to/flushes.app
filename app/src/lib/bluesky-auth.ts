// Bluesky OAuth client configuration
const BLUESKY_AUTH_SERVER = 'https://bsky.social';
const REDIRECT_URI = 'https://flushing.im/auth/callback';
const CLIENT_ID = 'https://flushing.im/client-metadata.json';
const SCOPES = 'atproto transition:generic';

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

// Generate a DPoP token
export async function generateDPoPToken(
  privateKey: CryptoKey,
  publicKey: JsonWebKey,
  method: string,
  url: string,
  nonce?: string
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

  if (nonce) {
    payload.nonce = nonce;
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
export async function getAuthorizationUrl(): Promise<{ url: string, state: string, codeVerifier: string, keyPair: CryptoKeyPair }> {
  const state = generateRandomString(32);
  const codeVerifier = generateRandomString(64);
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const keyPair = await generateDPoPKeyPair();
  const publicKey = await exportJWK(keyPair.publicKey);

  // Initial PAR request to get DPoP nonce
  const parEndpoint = `${BLUESKY_AUTH_SERVER}/.well-known/oauth-authorization-server`;
  const parResponse = await fetch(parEndpoint, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!parResponse.ok) {
    throw new Error(`Failed to fetch OAuth metadata: ${parResponse.statusText}`);
  }

  const metadata = await parResponse.json();
  const parsEndpoint = metadata.pushed_authorization_request_endpoint;
  
  // Now we need to make a PAR request
  // Note: In a real implementation, you would need to handle the DPoP nonce exchange
  // For simplicity, we're going directly to the authorization endpoint
  
  const authUrl = `${BLUESKY_AUTH_SERVER}/oauth/authorize` +
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
    keyPair
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

// Get access token from authorization code
export async function getAccessToken(
  code: string,
  codeVerifier: string,
  keyPair: CryptoKeyPair,
  dpopNonce?: string
): Promise<any> {
  const tokenEndpoint = `${BLUESKY_AUTH_SERVER}/oauth/token`;

  // ALWAYS get a fresh nonce first if we don't have one
  if (!dpopNonce) {
    console.log('No nonce provided, getting one...');
    const nonce = await getNonce(tokenEndpoint);
    if (nonce) {
      console.log('Obtained nonce:', nonce);
      return getAccessToken(code, codeVerifier, keyPair, nonce);
    } else {
      console.warn('Could not obtain a nonce, proceeding without one');
    }
  }

  console.log('Creating DPoP token with nonce:', dpopNonce);
  
  // Create DPoP token with nonce if we have one
  const publicKey = await exportJWK(keyPair.publicKey);
  const dpopToken = await generateDPoPToken(
    keyPair.privateKey,
    publicKey,
    'POST',
    tokenEndpoint,
    dpopNonce
  );

  console.log('Making token request with DPoP token');
  
  // Make the token request
  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'DPoP': dpopToken
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      code_verifier: codeVerifier
    })
  });

  // Handle 401 errors which might contain a DPoP nonce
  if (response.status === 401) {
    const newNonce = response.headers.get('DPoP-Nonce');
    let responseBody;
    
    try {
      responseBody = await response.json();
    } catch (e) {
      responseBody = {};
    }
    
    console.log('Received 401 response:', responseBody);
    console.log('New nonce from response:', newNonce);
    
    // If we got a new nonce, retry with it
    if (newNonce && newNonce !== dpopNonce) {
      console.log('Retrying with new nonce:', newNonce);
      return getAccessToken(code, codeVerifier, keyPair, newNonce);
    }
    
    // Otherwise, throw an error
    const responseText = JSON.stringify(responseBody);
    throw new Error(`Token request failed: ${response.status}, ${responseText}`);
  }

  // Handle other errors
  if (!response.ok) {
    let errorText;
    try {
      const errorJson = await response.json();
      errorText = JSON.stringify(errorJson);
    } catch (e) {
      errorText = await response.text();
    }
    throw new Error(`Token request failed: ${response.status}, ${errorText}`);
  }

  const responseData = await response.json();
  console.log('Token request successful');
  
  // Store the nonce for future use if provided in the response
  const returnedNonce = response.headers.get('DPoP-Nonce');
  if (returnedNonce) {
    responseData.dpop_nonce = returnedNonce;
  }
  
  return responseData;
}