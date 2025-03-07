import { NextRequest, NextResponse } from 'next/server';

const BLUESKY_AUTH_SERVER = 'https://bsky.social';
const REDIRECT_URI = 'https://flushing.im/auth/callback';
const CLIENT_ID = 'https://flushing.im/client-metadata.json';

// Function to get a nonce from Bluesky
async function getNonce(): Promise<string | null> {
  try {
    const tokenEndpoint = `${BLUESKY_AUTH_SERVER}/oauth/token`;
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
    const { code, codeVerifier, dpopToken } = body;
    
    if (!code || !codeVerifier || !dpopToken) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }
    
    // Get a nonce first
    const nonce = await getNonce();
    console.log('Got nonce from server-side:', nonce);
    
    // Forward the token request to Bluesky
    const tokenEndpoint = `${BLUESKY_AUTH_SERVER}/oauth/token`;
    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'DPoP': dpopToken,
        // Include any additional headers needed
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
        client_id: CLIENT_ID,
        code_verifier: codeVerifier
      })
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