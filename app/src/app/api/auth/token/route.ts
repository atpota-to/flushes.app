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
    
    // Use the provided PDS endpoint or default to Bluesky's
    // CRITICAL FIX: For third-party PDS, always use bsky.social for token requests
    let authServer = pdsEndpoint || DEFAULT_AUTH_SERVER;
    if (pdsEndpoint && !pdsEndpoint.includes('bsky.social')) {
      console.log(`Redirecting token request to bsky.social for third-party PDS: ${pdsEndpoint}`);
      authServer = DEFAULT_AUTH_SERVER;
    }
    
    if (!code || !codeVerifier || !dpopToken) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }
    
    // Get a nonce from the specified PDS
    const nonce = await getNonce(authServer);
    console.log(`Got nonce from server-side (${authServer}):`, nonce);
    
    // Forward the token request to the specified PDS
    const tokenEndpoint = `${authServer}/oauth/token`;
    console.log(`Making token request to: ${tokenEndpoint}`);
    
    // Prepare the form data
    const formData = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      code_verifier: codeVerifier
    });
    
    // For third-party PDS, add the 'resource' parameter with the original PDS endpoint
    // This is CRITICAL for the token exchange to work with third-party PDS servers
    if (originalPdsEndpoint && originalPdsEndpoint !== authServer) {
      console.log(`Adding resource parameter for third-party PDS: ${originalPdsEndpoint}`);
      formData.append('resource', originalPdsEndpoint);
    }
    
    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'DPoP': dpopToken,
        // Include any additional headers needed
      },
      body: formData
    });
    
    // Get the response data
    const responseData = await response.json();
    
    // If there's an error about missing nonce, return the nonce
    if (responseData.error === 'use_dpop_nonce') {
      const dpopNonce = response.headers.get('DPoP-Nonce');
      return NextResponse.json(
        { 
          error: 'use_dpop_nonce', 
          nonce: dpopNonce,
          originalError: responseData 
        },
        { status: 400 }
      );
    }
    
    // Log the token response for debugging
    console.log('Token response from Bluesky:', JSON.stringify({
      ...responseData,
      access_token: responseData.access_token ? '[REDACTED]' : null,
      refresh_token: responseData.refresh_token ? '[REDACTED]' : null,
    }));
    
    // Check if we have an audience in the token
    if (responseData.aud) {
      console.log('Token audience:', responseData.aud);
    } else {
      console.warn('No audience in token response');
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