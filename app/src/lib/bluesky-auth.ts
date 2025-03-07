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

// Get access token from authorization code
export async function getAccessToken(
  code: string,
  codeVerifier: string,
  keyPair: CryptoKeyPair,
  dpopNonce?: string
): Promise<any> {
  const tokenEndpoint = `${BLUESKY_AUTH_SERVER}/oauth/token`;

  const publicKey = await exportJWK(keyPair.publicKey);
  const dpopToken = await generateDPoPToken(
    keyPair.privateKey,
    publicKey,
    'POST',
    tokenEndpoint,
    dpopNonce
  );

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

  if (response.status === 401) {
    // Handle DPoP nonce errors
    const dpopNonce = response.headers.get('DPoP-Nonce');
    if (dpopNonce) {
      return getAccessToken(code, codeVerifier, keyPair, dpopNonce);
    }
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token request failed: ${response.status} ${response.statusText}, ${errorText}`);
  }

  return await response.json();
}