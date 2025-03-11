import { NextRequest, NextResponse } from 'next/server';

// Configure this route as dynamic to fix static generation issues
export const dynamic = 'force-dynamic';

const DEFAULT_AUTH_SERVER = 'https://bsky.social';

export async function POST(request: NextRequest) {
  try {
    // Parse request body to get PDS endpoint
    const body = await request.json();
    let pdsEndpoint = body.pdsEndpoint || DEFAULT_AUTH_SERVER;
    
    // CRITICAL FIX: Third-party PDS servers don't implement OAuth endpoints
    // Always use bsky.social for OAuth operations
    let authServer = pdsEndpoint;
    if (!pdsEndpoint.includes('bsky.social')) {
      console.log('[NONCE API] Redirecting to bsky.social for OAuth on third-party PDS');
      authServer = DEFAULT_AUTH_SERVER;
    }
    
    // Try to get a nonce from the auth server, not the PDS itself
    const tokenEndpoint = `${authServer}/oauth/token`;
    console.log(`[NONCE API] Attempting to get nonce from: ${tokenEndpoint}`);
    
    // Try multiple methods to get a nonce
    let nonce = null;
    
    // Method 1: HEAD request (most efficient)
    try {
      console.log(`[NONCE API] Trying HEAD request to ${tokenEndpoint}`);
      const headResponse = await fetch(tokenEndpoint, {
        method: 'HEAD',
        headers: {
          'Accept': '*/*'
        }
      });
      
      nonce = headResponse.headers.get('DPoP-Nonce');
      if (nonce) {
        console.log(`[NONCE API] Got nonce via HEAD request: ${nonce}`);
      }
    } catch (headError) {
      console.warn(`[NONCE API] HEAD request failed:`, headError);
    }
    
    // Method 2: OPTIONS request if HEAD fails
    if (!nonce) {
      try {
        console.log(`[NONCE API] Trying OPTIONS request to ${tokenEndpoint}`);
        const optionsResponse = await fetch(tokenEndpoint, {
          method: 'OPTIONS',
          headers: {
            'Accept': '*/*'
          }
        });
        
        nonce = optionsResponse.headers.get('DPoP-Nonce');
        if (nonce) {
          console.log(`[NONCE API] Got nonce via OPTIONS request: ${nonce}`);
        }
      } catch (optionsError) {
        console.warn(`[NONCE API] OPTIONS request failed:`, optionsError);
      }
    }
    
    // Method 3: POST probe (last resort)
    if (!nonce) {
      try {
        console.log(`[NONCE API] Trying POST probe to ${tokenEndpoint}`);
        const probeResponse = await fetch(tokenEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          // Empty body to trigger an error response that might contain a nonce
          body: new URLSearchParams({})
        });
        
        nonce = probeResponse.headers.get('DPoP-Nonce');
        if (nonce) {
          console.log(`[NONCE API] Got nonce via POST probe: ${nonce}`);
        }
      } catch (probeError) {
        console.warn(`[NONCE API] POST probe failed:`, probeError);
      }
    }
    
    // If we got a nonce through any method, return it
    if (nonce) {
      return NextResponse.json({ nonce });
    }
    
    // If all methods failed, return an error
    console.log(`[NONCE API] All methods failed to get a nonce from ${tokenEndpoint}`);
    return NextResponse.json(
      { error: 'Could not retrieve nonce', endpoint: tokenEndpoint },
      { status: 404 }
    );
  } catch (error: any) {
    console.error('[NONCE API] Nonce retrieval error:', error);
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
    console.log(`[NONCE API] GET: Attempting to get nonce from: ${tokenEndpoint}`);
    
    // Try multiple methods to get a nonce
    let nonce = null;
    
    // Method 1: HEAD request (most efficient)
    try {
      console.log(`[NONCE API] GET: Trying HEAD request to ${tokenEndpoint}`);
      const headResponse = await fetch(tokenEndpoint, {
        method: 'HEAD',
        headers: {
          'Accept': '*/*'
        }
      });
      
      nonce = headResponse.headers.get('DPoP-Nonce');
      if (nonce) {
        console.log(`[NONCE API] GET: Got nonce via HEAD request: ${nonce}`);
      }
    } catch (headError) {
      console.warn(`[NONCE API] GET: HEAD request failed:`, headError);
    }
    
    // Method 2: OPTIONS request if HEAD fails
    if (!nonce) {
      try {
        console.log(`[NONCE API] GET: Trying OPTIONS request to ${tokenEndpoint}`);
        const optionsResponse = await fetch(tokenEndpoint, {
          method: 'OPTIONS',
          headers: {
            'Accept': '*/*'
          }
        });
        
        nonce = optionsResponse.headers.get('DPoP-Nonce');
        if (nonce) {
          console.log(`[NONCE API] GET: Got nonce via OPTIONS request: ${nonce}`);
        }
      } catch (optionsError) {
        console.warn(`[NONCE API] GET: OPTIONS request failed:`, optionsError);
      }
    }
    
    // Method 3: POST probe (last resort)
    if (!nonce) {
      try {
        console.log(`[NONCE API] GET: Trying POST probe to ${tokenEndpoint}`);
        const probeResponse = await fetch(tokenEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          // Empty body to trigger an error response that might contain a nonce
          body: new URLSearchParams({})
        });
        
        nonce = probeResponse.headers.get('DPoP-Nonce');
        if (nonce) {
          console.log(`[NONCE API] GET: Got nonce via POST probe: ${nonce}`);
        }
      } catch (probeError) {
        console.warn(`[NONCE API] GET: POST probe failed:`, probeError);
      }
    }
    
    // If we got a nonce through any method, return it
    if (nonce) {
      return NextResponse.json({ nonce });
    }
    
    // If all methods failed, return an error
    console.log(`[NONCE API] GET: All methods failed to get a nonce from ${tokenEndpoint}`);
    return NextResponse.json(
      { error: 'Could not retrieve nonce', endpoint: tokenEndpoint },
      { status: 404 }
    );
  } catch (error: any) {
    console.error('[NONCE API] GET: Nonce retrieval error:', error);
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