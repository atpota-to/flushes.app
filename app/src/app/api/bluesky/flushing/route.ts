import { NextRequest, NextResponse } from 'next/server';
import { containsBannedWords, sanitizeText } from '@/lib/content-filter';

// This is the default API URL, but we'll use the user's PDS endpoint instead if available
const DEFAULT_API_URL = 'https://bsky.social/xrpc';
const FLUSHING_STATUS_NSID = 'im.flushing.right.now';

export async function POST(request: NextRequest) {
  try {
    const { accessToken, dpopToken, did, text, emoji, pdsEndpoint } = await request.json();
    
    if (!accessToken || !dpopToken || !did || !text || !emoji) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }
    
    // Use the user's PDS endpoint if available
    if (!pdsEndpoint) {
      return NextResponse.json(
        { error: 'MissingPDSEndpoint', message: 'PDS endpoint is required for OAuth tokens' },
        { status: 400 }
      );
    }
    
    // Check for banned words in the text
    if (containsBannedWords(text)) {
      return NextResponse.json(
        { 
          error: 'ContentViolation', 
          message: 'Your post contains inappropriate content that violates our community guidelines.' 
        },
        { status: 400 }
      );
    }
    
    // Sanitize the text just in case (defensive programming)
    const sanitizedText = sanitizeText(text);
    
    const apiUrl = `${pdsEndpoint}/xrpc`;
    
    // Create the record
    const record = {
      $type: FLUSHING_STATUS_NSID,
      text: sanitizedText, // Use the sanitized text
      emoji,
      createdAt: new Date().toISOString()
    };
    
    const body = {
      repo: did,
      collection: FLUSHING_STATUS_NSID,
      record
    };
    
    // We're creating a record with the user's credentials
    
    // We're now doing nonce handling on the client side
    
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
    
    // Process the response
    let responseText = '';
    let responseData: Record<string, any> = {};
    
    try {
        responseText = await response.text();
        
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
      
      // Try to extract nonce from error response body
      if (typeof responseData === 'object' && responseData !== null) {
        if (
          responseData.error === 'InvalidDpop' || 
          responseData.error === 'InvalidToken' ||
          (responseData.message && responseData.message.includes('nonce'))
        ) {
          // Look for a nonce in the message
          const nonceMatch = responseData.message?.match(/nonce: ([A-Za-z0-9_-]+)/);
          if (nonceMatch && nonceMatch[1]) {
            const extractedNonce = nonceMatch[1];
            console.log('Extracted nonce from error message:', extractedNonce);
            return NextResponse.json({
              error: 'use_dpop_nonce',
              nonce: extractedNonce,
              originalError: responseData
            }, { status: 401 });
          }
        }
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