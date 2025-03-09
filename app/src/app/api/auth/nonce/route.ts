import { NextRequest, NextResponse } from 'next/server';

const DEFAULT_AUTH_SERVER = 'https://bsky.social';

export async function POST(request: NextRequest) {
  try {
    // Parse request body to get PDS endpoint
    const body = await request.json();
    const pdsEndpoint = body.pdsEndpoint || DEFAULT_AUTH_SERVER;
    
    // Try to get a nonce from the specified PDS
    const tokenEndpoint = `${pdsEndpoint}/oauth/token`;
    console.log(`Attempting to get nonce from: ${tokenEndpoint}`);
    
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
          { error: 'Could not retrieve nonce', endpoint: tokenEndpoint },
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

// Maintain backward compatibility
export async function GET() {
  try {
    // Use the default Bluesky server
    const tokenEndpoint = `${DEFAULT_AUTH_SERVER}/oauth/token`;
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