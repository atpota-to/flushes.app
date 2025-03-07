import { NextRequest, NextResponse } from 'next/server';

const BLUESKY_AUTH_SERVER = 'https://bsky.social';

export async function GET() {
  try {
    // Try to get a nonce from Bluesky
    const tokenEndpoint = `${BLUESKY_AUTH_SERVER}/oauth/token`;
    const response = await fetch(tokenEndpoint, {
      method: 'HEAD',
      headers: {
        'Accept': '*/*'
      }
    });
    
    const nonce = response.headers.get('DPoP-Nonce');
    
    if (nonce) {
      return NextResponse.json({ nonce });
    } else {
      // Try another method if HEAD doesn't work
      const probeResponse = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        // Empty body to trigger an error response that might contain a nonce
        body: new URLSearchParams({})
      });
      
      const probeNonce = probeResponse.headers.get('DPoP-Nonce');
      
      if (probeNonce) {
        return NextResponse.json({ nonce: probeNonce });
      } else {
        return NextResponse.json(
          { error: 'Could not retrieve nonce' },
          { status: 404 }
        );
      }
    }
  } catch (error: any) {
    console.error('Nonce retrieval error:', error);
    return NextResponse.json(
      { error: 'Nonce retrieval error', message: error.message },
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
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}