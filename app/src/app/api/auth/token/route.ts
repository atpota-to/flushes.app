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
    
    // Use the provided PDS endpoint or default to Bluesky's
    // CRITICAL FIX: For third-party PDS, always use bsky.social for token requests
    let authServer = pdsEndpoint || DEFAULT_AUTH_SERVER;
    if (pdsEndpoint && !pdsEndpoint.includes('bsky.social')) {
      console.log(`[TOKEN ROUTE] Redirecting token request to bsky.social for third-party PDS: ${pdsEndpoint}`);
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
    
    // For third-party PDS, add the 'resource' AND 'issuer' parameters
    // These are CRITICAL for the token exchange to work with third-party PDS servers
    if (originalPdsEndpoint && originalPdsEndpoint !== authServer) {
      console.log(`[TOKEN ROUTE] Adding resource parameter for third-party PDS: ${originalPdsEndpoint}`);
      formData.append('resource', originalPdsEndpoint);
      
      // Add the issuer parameter which is required for cross-domain OAuth
      console.log(`[TOKEN ROUTE] Adding issuer parameter for third-party PDS: ${originalPdsEndpoint}`);
      formData.append('issuer', originalPdsEndpoint);
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
    console.log('[TOKEN ROUTE] Response headers:', Object.fromEntries([...response.headers.entries()]));
    
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