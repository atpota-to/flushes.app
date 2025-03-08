import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const DEFAULT_API_URL = 'https://bsky.social/xrpc';
const MAX_ENTRIES = 50;

// Supabase client - using environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// GET user's flushing statuses
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const handle = searchParams.get('handle');
    
    if (!handle) {
      return NextResponse.json(
        { error: 'Missing handle parameter' },
        { status: 400 }
      );
    }
    
    // If we have Supabase credentials, query the database
    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      try {
        let query = supabase
          .from('flushing_records')
          .select('*', { count: 'exact' });
          
        // Handle can be either a handle or a DID
        // First try with the handle as is
        query = query.eq('did', handle);
          
        // Order by created_at descending and limit
        const { data: entries, error, count } = await query
          .order('created_at', { ascending: false })
          .limit(MAX_ENTRIES);
        
        if (error) {
          console.error('Supabase query error:', error);
          throw new Error(`Failed to fetch profile statuses: ${error.message}`);
        }
        
        return NextResponse.json({
          entries: entries || [],
          count: count || 0
        });
      } catch (dbError: any) {
        console.error('Database error:', dbError);
        return NextResponse.json(
          { error: 'Failed to fetch profile statuses', details: dbError.message },
          { status: 500 }
        );
      }
    } else {
      return NextResponse.json(
        { error: 'Supabase credentials not configured' },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Profile statuses API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch profile statuses', details: error.message },
      { status: 500 }
    );
  }
}

// POST for authenticated profile information
export async function POST(request: NextRequest) {
  try {
    const { accessToken, dpopToken, handle, pdsEndpoint } = await request.json();
    
    if (!accessToken || !dpopToken) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }
    
    // Use the PDS endpoint if provided, otherwise use the default
    const apiUrl = pdsEndpoint ? `${pdsEndpoint}/xrpc` : DEFAULT_API_URL;
    
    // We can resolve either a handle or a DID
    let url;
    if (handle && handle.startsWith('did:')) {
      // If it's a DID, use describeRepo to get details
      url = `${apiUrl}/com.atproto.repo.describeRepo?repo=${encodeURIComponent(handle)}`;
    } else {
      // Otherwise treat it as a handle to resolve
      const userHandle = handle || 'atproto.com';
      url = `${apiUrl}/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(userHandle)}`;
    }
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `DPoP ${accessToken}`,
        'DPoP': dpopToken
      }
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
    if (!response.ok) {
      let errorText = '';
      let errorObj: Record<string, any> = {};
      
      try {
        errorText = await response.text();
        console.error('Error from Bluesky:', response.status, errorText);
        
        // Try to parse the response as JSON if it's not empty
        if (errorText) {
          try {
            errorObj = JSON.parse(errorText);
          } catch (parseError) {
            console.error('Failed to parse error response as JSON:', parseError);
          }
        }
      } catch (e) {
        console.error('Error reading response:', e);
      }
      
      // If we can't get the profile, return a basic response to continue the flow
      if (response.status === 400) {
        return NextResponse.json({
          did: 'unknown_did',
          handle: 'unknown'
        });
      }
      
      return NextResponse.json(
        { error: 'Profile fetch error', message: errorText, details: errorObj },
        { status: response.status }
      );
    }
    
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Profile fetch error:', error);
    // Return a basic profile to continue the flow
    return NextResponse.json({
      did: 'unknown_did',
      handle: 'unknown'
    });
  }
}

// Handle OPTIONS requests for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, DPoP',
    },
  });
}