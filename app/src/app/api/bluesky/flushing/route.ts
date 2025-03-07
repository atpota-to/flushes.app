import { NextRequest, NextResponse } from 'next/server';

const API_URL = 'https://bsky.social/xrpc';
const FLUSHING_STATUS_NSID = 'im.flushing.right.now';

export async function POST(request: NextRequest) {
  try {
    const { accessToken, dpopToken, did, text, emoji } = await request.json();
    
    if (!accessToken || !dpopToken || !did || !text || !emoji) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
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
    
    // Make the request to Bluesky
    const response = await fetch(`${API_URL}/com.atproto.repo.createRecord`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `DPoP ${accessToken}`,
        'DPoP': dpopToken
      },
      body: JSON.stringify(body)
    });
    
    // Check for DPoP nonce error
    if (response.status === 401) {
      const newNonce = response.headers.get('DPoP-Nonce');
      const errorResponse = await response.json().catch(() => ({}));
      
      if (newNonce) {
        return NextResponse.json({
          error: 'use_dpop_nonce',
          nonce: newNonce,
          originalError: errorResponse
        }, { status: 401 });
      }
    }
    
    // Return the response
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
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