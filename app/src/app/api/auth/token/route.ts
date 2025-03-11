import { NextRequest, NextResponse } from 'next/server';

// Configure this route as dynamic to fix static generation issues
export const dynamic = 'force-dynamic';

const DEFAULT_AUTH_SERVER = 'https://bsky.social';
const REDIRECT_URI = 'https://flushes.app/auth/callback';
const CLIENT_ID = 'https://flushes.app/client-metadata.json';

// Function to get a nonce from the specified PDS
async function getNonce(pdsEndpoint: string): Promise<string | null> {
  try {
    const tokenEndpoint = `${pdsEndpoint}/oauth/token`;
    const headResponse = await fetch(tokenEndpoint, {
      method: 'HEAD',
      headers: {
        'Accept': '*/*'
      }
    });
    
    return headResponse.headers.get('DPoP-Nonce');
  } catch (error) {
    console.error('Error getting nonce:', error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Parse the request body
    const body = await request.json();
    const { code, codeVerifier, dpopToken, pdsEndpoint, originalPdsEndpoint } = body;
    
    // Enhanced logging
    console.log('[TOKEN ROUTE] Request parameters:', { 
      code: code ? code.substring(0, 6) + '...' : 'none', // Only log first few chars of sensitive data
      codeVerifier: codeVerifier ? codeVerifier.substring(0, 6) + '...' : 'none',
      pdsEndpoint,
      originalPdsEndpoint,
      dpopTokenProvided: !!dpopToken
    });
    
    // CRITICAL FIX: Use the correct token endpoint based on PDS type
    // - For bsky.network PDSes: always use bsky.social for token exchange
    // - For third-party PDSes: use their own endpoint for token exchange
    let authServer = pdsEndpoint || DEFAULT_AUTH_SERVER;
    
    if (pdsEndpoint) {
      // If it's a bsky.network PDS, use bsky.social
      if (pdsEndpoint.includes('bsky.network')) {
        console.log(`[TOKEN ROUTE] Using bsky.social for bsky.network PDS: ${pdsEndpoint}`);
        authServer = DEFAULT_AUTH_SERVER;
      } else if (pdsEndpoint.includes('bsky.social')) {
        // Already using bsky.social
        console.log(`[TOKEN ROUTE] Using bsky.social endpoint directly`);
      } else {
        // For third-party PDSes, use their own endpoint for token exchange
        console.log(`[TOKEN ROUTE] Using third-party PDS's own endpoint for token exchange: ${pdsEndpoint}`);
        // Keep authServer as the original PDS endpoint
      }
    } else {
      // Default to bsky.social if no PDS endpoint provided
      console.log(`[TOKEN ROUTE] No PDS endpoint provided, using default: ${DEFAULT_AUTH_SERVER}`);
      authServer = DEFAULT_AUTH_SERVER;
    }
    
    if (!code || !codeVerifier || !dpopToken) {
      const missingParams = [];
      if (!code) missingParams.push('code');
      if (!codeVerifier) missingParams.push('codeVerifier');
      if (!dpopToken) missingParams.push('dpopToken');
      
      console.error(`[TOKEN ROUTE] Missing required parameters: ${missingParams.join(', ')}`);
      return NextResponse.json(
        { error: 'Missing required parameters', missing: missingParams },
        { status: 400 }
      );
    }
    
    // Get a nonce from the specified PDS
    const nonce = await getNonce(authServer);
    console.log(`[TOKEN ROUTE] Got nonce from server-side (${authServer}):`, nonce);
    
    // Forward the token request to the specified PDS
    const tokenEndpoint = `${authServer}/oauth/token`;
    console.log(`[TOKEN ROUTE] Making token request to: ${tokenEndpoint}`);
    
    // Prepare the form data
    const formData = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      code_verifier: codeVerifier
    });
    
    // CRITICAL FIX: We only need to add cross-domain parameters when using bsky.social 
    // for a third-party PDS's code exchange (which we're no longer doing)
    // But we'll keep this logic in case it's needed for specific PDS implementations
    if (originalPdsEndpoint && originalPdsEndpoint !== authServer) {
      console.log(`[TOKEN ROUTE] Cross-domain token exchange detected`);
      console.log(`[TOKEN ROUTE] Not adding cross-domain parameters as we're using direct PDS endpoints`);
    }
    
    // Log the complete request for debugging
    console.log('[TOKEN ROUTE] Complete token request:', {
      url: tokenEndpoint,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'DPoP': dpopToken ? '[TOKEN PRESENT]' : '[MISSING]'
      },
      formData: Object.fromEntries(formData)
    });
    
    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'DPoP': dpopToken,
        // Include any additional headers needed
      },
      body: formData
    });
    
    // Log response status and headers
    console.log(`[TOKEN ROUTE] Response status: ${response.status}`);
    
    // Log headers in a TypeScript-compatible way
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });
    console.log('[TOKEN ROUTE] Response headers:', headers);
    
    // Get the response data
    const responseData = await response.json();
    
    // Log complete error response for debugging
    if (!response.ok) {
      console.error('[TOKEN ROUTE] Token request failed with status:', response.status);
      console.error('[TOKEN ROUTE] Error response:', responseData);
      
      // For invalid_grant errors, provide more context
      if (responseData.error === 'invalid_grant') {
        console.error(`[TOKEN ROUTE] Invalid grant error details: 
          - The authorization code might have expired
          - The code_verifier might not match what was used for code_challenge
          - For third-party PDS: resource parameter might be incorrect
          - Client ID might not match what was used in authorization request
          - Redirect URI might not match what was used in authorization request
        `);
      }
    }
    
    // If there's an error about missing nonce, return the nonce
    if (responseData.error === 'use_dpop_nonce') {
      const dpopNonce = response.headers.get('DPoP-Nonce');
      console.log(`[TOKEN ROUTE] Got DPoP-Nonce from error response: ${dpopNonce}`);
      return NextResponse.json(
        { 
          error: 'use_dpop_nonce', 
          nonce: dpopNonce,
          originalError: responseData 
        },
        { status: 400 }
      );
    }
    
    // Log the token response for debugging (with sensitive data redacted)
    if (response.ok) {
      console.log('[TOKEN ROUTE] Token response from Bluesky:', JSON.stringify({
        ...responseData,
        access_token: responseData.access_token ? '[REDACTED]' : null,
        refresh_token: responseData.refresh_token ? '[REDACTED]' : null,
      }));
      
      // Check if we have an audience in the token
      if (responseData.aud) {
        console.log('[TOKEN ROUTE] Token audience:', responseData.aud);
      } else {
        console.warn('[TOKEN ROUTE] No audience in token response');
      }
    }
    
    // Return the response
    return NextResponse.json(responseData, { status: response.status });
  } catch (error: any) {
    console.error('Token proxy error:', error);
    return NextResponse.json(
      { error: 'Token proxy error', message: error.message },
      { status: 500 }
    );
  }
}

// Handle OPTIONS requests for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, DPoP',
    },
  });
}