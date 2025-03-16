import { NextRequest, NextResponse } from 'next/server';
import { containsBannedWords, sanitizeText } from '@/lib/content-filter';

// Configure this route as dynamic to fix static generation issues
export const dynamic = 'force-dynamic';

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
    
    console.log(`Using PDS endpoint: ${pdsEndpoint} for creating flush record`);
    
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
    
    const createRecordUrl = `${apiUrl}/com.atproto.repo.createRecord`;
    console.log(`Creating record at ${createRecordUrl}`);
    
    // Detailed logging for debugging third-party PDSs
    console.log(`Making record creation request with:
      - URL: ${createRecordUrl}
      - PDS Endpoint: ${pdsEndpoint} 
      - DID: ${did.substring(0, 10)}...
      - Record type: ${FLUSHING_STATUS_NSID}
    `);
    
    // Make the request to user's PDS
    const response = await fetch(createRecordUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `DPoP ${accessToken}`,
        'DPoP': dpopToken
      },
      body: JSON.stringify(body)
    });
    
    console.log(`Record creation response status: ${response.status}`);
    
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
    
    // Enhanced handling for DPoP nonce errors
    if (response.status === 401 || response.status === 400) {
      // First check for nonce in headers (most common)
      const headerNonce = response.headers.get('DPoP-Nonce');
      if (headerNonce) {
        console.log(`Found DPoP-Nonce in headers: ${headerNonce}`);
        return NextResponse.json({
          error: 'use_dpop_nonce',
          nonce: headerNonce,
          originalError: responseData
        }, { status: 401 });
      }
      
      // Log all headers for debugging
      console.log('All response headers:');
      response.headers.forEach((value, key) => {
        console.log(`  ${key}: ${value}`);
      });
      
      // Check for nonce in body (some third-party PDSs)
      if (typeof responseData === 'object' && responseData !== null) {
        console.log('Checking response body for nonce information');
        
        // Check direct nonce field
        if (responseData.nonce) {
          console.log(`Found nonce directly in response body: ${responseData.nonce}`);
          return NextResponse.json({
            error: 'use_dpop_nonce',
            nonce: responseData.nonce,
            originalError: responseData
          }, { status: 401 });
        }
        
        // Check various error patterns
        if (
          responseData.error === 'InvalidDpop' || 
          responseData.error === 'InvalidToken' ||
          responseData.error === 'use_dpop_nonce' ||
          (responseData.message && (
            responseData.message.includes('nonce') ||
            responseData.message.includes('DPoP')
          ))
        ) {
          // Extended regex pattern to match various nonce formats
          const noncePatterns = [
            /nonce: ([A-Za-z0-9_-]+)/,
            /nonce="([A-Za-z0-9_-]+)"/,
            /nonce=([A-Za-z0-9_-]+)/,
            /DPoP-Nonce: ([A-Za-z0-9_-]+)/,
            /DPoP nonce: ([A-Za-z0-9_-]+)/,
            /dpop-nonce: ([A-Za-z0-9_-]+)/i,
            /dpop nonce: ([A-Za-z0-9_-]+)/i,
            /nonce '([A-Za-z0-9_-]+)'/,
            /Nonce: ([A-Za-z0-9_-]+)/,
            /"nonce":"([A-Za-z0-9_-]+)"/,
          ];
          
          // Try each pattern
          for (const pattern of noncePatterns) {
            const match = responseData.message?.match(pattern);
            if (match && match[1]) {
              const extractedNonce = match[1];
              console.log(`Extracted nonce from error message using pattern ${pattern}: ${extractedNonce}`);
              return NextResponse.json({
                error: 'use_dpop_nonce',
                nonce: extractedNonce,
                originalError: responseData
              }, { status: 401 });
            }
          }
          
          // If we couldn't extract a nonce but it seems like a nonce error
          console.log('Potential nonce error detected but couldn\'t extract nonce value. Full error:', responseData);
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