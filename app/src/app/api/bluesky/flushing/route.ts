import { NextRequest, NextResponse } from 'next/server';

// This is the default API URL, but we'll use the user's PDS endpoint instead if available
const DEFAULT_API_URL = 'https://bsky.social/xrpc';
const FLUSHING_STATUS_NSID = 'im.flushing.right.now';

export async function POST(request: NextRequest) {
  try {
    const { accessToken, dpopToken, did, text, emoji, pdsEndpoint } = await request.json();
    
    console.log('API received pdsEndpoint:', pdsEndpoint);
    
    if (!accessToken || !dpopToken || !did || !text || !emoji) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }
    
    // Use the user's PDS endpoint if available
    const apiUrl = pdsEndpoint ? `${pdsEndpoint}/xrpc` : DEFAULT_API_URL;
    console.log('Using API URL:', apiUrl);
    
    // If we're still using the default URL, that's likely the issue
    if (apiUrl === DEFAULT_API_URL) {
      console.warn('WARNING: Using default API URL instead of PDS endpoint. This will likely fail with "OAuth tokens are meant for PDS access only"');
    }
    
    // Create the record
    const record = {
      $type: FLUSHING_STATUS_NSID,
      text,
      emoji,
      createdAt: new Date().toISOString()
    };
    
    const body = {
      repo: did,
      collection: FLUSHING_STATUS_NSID,
      record
    };
    
    // Debug the request
    console.log('Creating record with body:', JSON.stringify(body));
    
    // Make the request to user's PDS
    const response = await fetch(`${apiUrl}/com.atproto.repo.createRecord`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `DPoP ${accessToken}`,
        'DPoP': dpopToken
      },
      body: JSON.stringify(body)
    });
    
    // Debug the response
    console.log('Create record response status:', response.status);
    let responseText = '';
    let responseData = {};
    
    try {
        responseText = await response.text();
        console.log('Create record response:', responseText);
        
        // Try to parse the response as JSON if it's not empty
        if (responseText) {
            try {
                responseData = JSON.parse(responseText);
            } catch (parseError) {
                console.error('Failed to parse response as JSON:', parseError);
            }
        }
    } catch (e) {
        console.error('Error reading response:', e);
    }
    
    // Check for DPoP nonce error
    if (response.status === 401) {
      const newNonce = response.headers.get('DPoP-Nonce');
      
      if (newNonce) {
        return NextResponse.json({
          error: 'use_dpop_nonce',
          nonce: newNonce,
          originalError: responseData
        }, { status: 401 });
      }
    }
    
    // If there's an error, return it with more details
    if (!response.ok) {
        // Handle responseData which might be an empty object
        const errorObj = typeof responseData === 'object' && responseData !== null ? responseData : {};
        
        return NextResponse.json({
            error: (errorObj as any).error || 'Status creation failed',
            message: (errorObj as any).message || responseText,
            status: response.status,
            details: errorObj
        }, { status: response.status });
    }
    
    // Return the response
    return NextResponse.json(responseData, { status: response.status });
  } catch (error: any) {
    console.error('Create flushing status error:', error);
    return NextResponse.json(
      { error: 'Status creation error', message: error.message },
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
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, DPoP',
    },
  });
}