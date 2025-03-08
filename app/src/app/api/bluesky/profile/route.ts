import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const DEFAULT_API_URL = 'https://bsky.social/xrpc';
const MAX_ENTRIES = 50;
const FLUSHING_STATUS_NSID = 'im.flushing.right.now';

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
    
    // Step 1: Get the user's DID from their handle
    let did = handle;
    // If the handle doesn't look like a DID, resolve it
    if (!handle.startsWith('did:')) {
      try {
        const resolveResponse = await fetch(`https://bsky.social/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`);
        
        if (!resolveResponse.ok) {
          return NextResponse.json(
            { error: `Failed to resolve handle: ${resolveResponse.statusText}` },
            { status: resolveResponse.status }
          );
        }
        
        const resolveData = await resolveResponse.json();
        did = resolveData.did;
      } catch (error: any) {
        return NextResponse.json(
          { error: `Failed to resolve handle: ${error.message}` },
          { status: 500 }
        );
      }
    }
    
    // Step 2: Get the PDS service endpoint from PLC directory
    let serviceEndpoint = 'https://bsky.social'; // Default fallback
    try {
      const plcResponse = await fetch(`https://plc.directory/${did}/data`);
      
      if (plcResponse.ok) {
        const plcData = await plcResponse.json();
        
        // Extract service endpoint from PLC data
        if (plcData && plcData.service) {
          // Find the atproto PDS service
          const pdsService = plcData.service.find((s: any) => 
            s.type === 'AtprotoPersonalDataServer' || s.type === 'AtprotoDataServer'
          );
          
          if (pdsService && pdsService.endpoint) {
            serviceEndpoint = pdsService.endpoint;
          }
        }
      }
    } catch (error: any) {
      console.warn(`Failed to get service endpoint from PLC directory: ${error.message}`);
      // Continue with default endpoint
    }
    
    // Step 3: Call the repo.listRecords API to get the user's flushing statuses
    try {
      const listRecordsUrl = `${serviceEndpoint}/xrpc/com.atproto.repo.listRecords?repo=${encodeURIComponent(did)}&collection=${encodeURIComponent(FLUSHING_STATUS_NSID)}&limit=${MAX_ENTRIES}`;
      
      const recordsResponse = await fetch(listRecordsUrl, {
        headers: {
          'Accept': 'application/json'
        }
      });
      
      if (!recordsResponse.ok) {
        // If failed with one endpoint, try with the default endpoint
        if (serviceEndpoint !== 'https://bsky.social') {
          console.warn(`Failed to get records from ${serviceEndpoint}, trying default endpoint`);
          const fallbackUrl = `https://bsky.social/xrpc/com.atproto.repo.listRecords?repo=${encodeURIComponent(did)}&collection=${encodeURIComponent(FLUSHING_STATUS_NSID)}&limit=${MAX_ENTRIES}`;
          
          const fallbackResponse = await fetch(fallbackUrl, {
            headers: {
              'Accept': 'application/json'
            }
          });
          
          if (!fallbackResponse.ok) {
            return NextResponse.json(
              { error: `Failed to fetch records: ${fallbackResponse.statusText}` },
              { status: fallbackResponse.status }
            );
          }
          
          const fallbackData = await fallbackResponse.json();
          
          // Transform the records into our format
          const transformedEntries = fallbackData.records.map((record: any) => ({
            id: record.uri,
            uri: record.uri,
            cid: record.cid,
            did: did,
            text: record.value.text || '',
            emoji: record.value.emoji || '🚽',
            created_at: record.value.createdAt
          }));
          
          return NextResponse.json({
            entries: transformedEntries,
            count: transformedEntries.length,
            cursor: fallbackData.cursor
          });
        }
        
        return NextResponse.json(
          { error: `Failed to fetch records: ${recordsResponse.statusText}` },
          { status: recordsResponse.status }
        );
      }
      
      const recordsData = await recordsResponse.json();
      
      // Transform the records into our format
      const transformedEntries = recordsData.records.map((record: any) => ({
        id: record.uri,
        uri: record.uri,
        cid: record.cid,
        did: did,
        text: record.value.text || '',
        emoji: record.value.emoji || '🚽',
        created_at: record.value.createdAt
      }));
      
      return NextResponse.json({
        entries: transformedEntries,
        count: transformedEntries.length,
        cursor: recordsData.cursor
      });
    } catch (error: any) {
      console.error('Error fetching records:', error);
      
      // If we have Supabase as a fallback, try that
      if (supabaseUrl && supabaseKey) {
        console.log('Falling back to Supabase records');
        const supabase = createClient(supabaseUrl, supabaseKey);
        
        const { data: entries, error: dbError, count } = await supabase
          .from('flushing_records')
          .select('*', { count: 'exact' })
          .eq('did', did)
          .order('created_at', { ascending: false })
          .limit(MAX_ENTRIES);
        
        if (dbError) {
          return NextResponse.json(
            { error: `Database error: ${dbError.message}` },
            { status: 500 }
          );
        }
        
        return NextResponse.json({
          entries: entries || [],
          count: count || 0
        });
      }
      
      return NextResponse.json(
        { error: `Failed to fetch records: ${error.message}` },
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