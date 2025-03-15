import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Configure this route as dynamic to fix static generation issues
export const dynamic = 'force-dynamic';
import { containsBannedWords, sanitizeText } from '@/lib/content-filter';

// Define interfaces for type safety
interface ProfileEntry {
  id: string;
  uri: string;
  cid: string;
  did: string;
  text: string;
  emoji: string;
  created_at: string;
}

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
    
    // Special case for plumber account redirect
    if (handle === 'plumber.flushing.im') {
      console.log('Redirecting from old plumber.flushing.im handle to plumber.flushes.app');
      return NextResponse.redirect(new URL(`/profile/plumber.flushes.app`, request.url));
    }
    
    // Step 1: Get the user's DID from their handle
    let did = handle;
    let userProfile = null;
    
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
        
        // Step 1.5: Get user profile data including description
        try {
          const profileResponse = await fetch(`https://bsky.social/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(did)}`);
          
          if (profileResponse.ok) {
            userProfile = await profileResponse.json();
            console.log(`Fetched profile data for ${handle}: ${userProfile.description ? 'Has description' : 'No description'}`);
          } else {
            console.warn(`Failed to fetch profile data: ${profileResponse.statusText}`);
          }
        } catch (profileError: any) {
          console.warn(`Error fetching profile data: ${profileError.message}`);
        }
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
          
          // Transform the records into our format and filter out banned content
          const transformedEntries = fallbackData.records
            .map((record: any) => {
              const text = record.value.text || '';
              
              // Skip entries with banned content
              if (containsBannedWords(text)) {
                return null;
              }
              
              return {
                id: record.uri,
                uri: record.uri,
                cid: record.cid,
                did: did,
                text: sanitizeText(text), // Sanitize text
                emoji: record.value.emoji || '🚽',
                created_at: record.value.createdAt
              };
            })
            .filter((entry: ProfileEntry | null): entry is ProfileEntry => entry !== null); // Remove filtered entries
          
          return NextResponse.json({
            entries: transformedEntries,
            count: transformedEntries.length,
            cursor: fallbackData.cursor,
            profile: userProfile
          });
        }
        
        return NextResponse.json(
          { error: `Failed to fetch records: ${recordsResponse.statusText}` },
          { status: recordsResponse.status }
        );
      }
      
      const recordsData = await recordsResponse.json();
      
      // Transform the records into our format and filter out banned content
      const transformedEntries = recordsData.records
        .map((record: any) => {
          const text = record.value.text || '';
          
          // Skip entries with banned content
          if (containsBannedWords(text)) {
            return null;
          }
          
          return {
            id: record.uri,
            uri: record.uri,
            cid: record.cid,
            did: did,
            text: sanitizeText(text), // Sanitize text
            emoji: record.value.emoji || '🚽',
            created_at: record.value.createdAt
          };
        })
        .filter((entry: ProfileEntry | null): entry is ProfileEntry => entry !== null); // Remove filtered entries
      
      return NextResponse.json({
        entries: transformedEntries,
        count: transformedEntries.length,
        cursor: recordsData.cursor,
        profile: userProfile
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
        
        // Filter and sanitize entries from Supabase
        const filteredEntries = (entries || [])
          .map((entry: any) => {
            // Skip entries with banned content
            if (containsBannedWords(entry.text)) {
              return null;
            }
            
            // Return sanitized entry
            return {
              ...entry,
              text: sanitizeText(entry.text || '')
            };
          })
          .filter((entry: any): entry is any => entry !== null);
        
        return NextResponse.json({
          entries: filteredEntries,
          count: filteredEntries.length, // Update count to reflect filtered entries
          profile: userProfile
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
    console.log(`Using API URL for profile fetch: ${apiUrl}`);
    
    // Special handling for third-party PDS
    // First get the user's DID if we're looking up a handle
    let userDid = handle;
    let userHandle = handle;
    let resolveHandle = handle; // Create a new variable we can modify
    
    // Special case for plumber account handles
    if (handle === 'plumber.flushing.im') {
      console.log('Converting old plumber.flushing.im handle to plumber.flushes.app in API');
      resolveHandle = 'plumber.flushes.app'; 
      userHandle = 'plumber.flushes.app';
    } else {
      resolveHandle = handle;
    }
    
    try {
      if (!resolveHandle.startsWith('did:')) {
        // Always use bsky.social for resolving handles to DIDs
        const resolveResponse = await fetch(`https://bsky.social/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(resolveHandle)}`);
        
        if (!resolveResponse.ok) {
          console.error(`Failed to resolve handle ${resolveHandle}:`, await resolveResponse.text());
          throw new Error(`Failed to resolve handle: ${resolveResponse.statusText}`);
        }
        
        const resolveData = await resolveResponse.json();
        userDid = resolveData.did;
        userHandle = resolveHandle;
        console.log(`Resolved handle ${resolveHandle} to DID ${userDid}`);
      } else {
        // If we're given a DID, try to find the handle
        try {
          // Try PLC directory first
          const plcResponse = await fetch(`https://plc.directory/${resolveHandle}/data`);
          
          if (plcResponse.ok) {
            const plcData = await plcResponse.json();
            if (plcData.alsoKnownAs && plcData.alsoKnownAs.length > 0) {
              const handleUrl = plcData.alsoKnownAs[0];
              if (handleUrl.startsWith('at://')) {
                userHandle = handleUrl.substring(5); // Remove 'at://'
                console.log(`Resolved DID ${handle} to handle ${userHandle}`);
              }
            }
          }
        } catch (plcError) {
          console.warn('Failed to resolve handle from PLC directory:', plcError);
        }
      }
      
      // Now use the correct endpoint for looking up the profile
      const url = `${apiUrl}/com.atproto.repo.describeRepo?repo=${encodeURIComponent(userDid)}`;
    
      console.log(`Making profile request to: ${url}`);
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
        if (newNonce) {
          console.log('Received nonce from profile request:', newNonce);
          return NextResponse.json({
            error: 'use_dpop_nonce',
            nonce: newNonce
          }, { status: 401 });
        }
      }
      
      // If we get a successful response
      if (response.ok) {
        const data = await response.json();
        console.log('Successfully fetched profile data');
        
        // IMPORTANT: For third-party PDS users, we need to use the handle from describeRepo
        // which will be accurate for their PDS, rather than the handle we resolved earlier
        if (pdsEndpoint && pdsEndpoint !== 'https://bsky.social' && data.handle) {
          console.log(`Using handle from PDS response: ${data.handle} instead of ${userHandle}`);
          userHandle = data.handle;
        }
        
        // Return profile information with both DID and handle
        return NextResponse.json({
          did: userDid,
          handle: userHandle
        });
      }
      
      // Handle error response
      console.error(`Profile request failed with status: ${response.status}`);
      let errorText = await response.text().catch(() => 'Failed to read response');
      console.error('Error from profile request:', errorText);
      
      // Return information with the handle/DID we resolved
      return NextResponse.json({
        did: userDid,
        handle: userHandle,
        error: `Profile request failed with status: ${response.status}`
      });
      
    } catch (error: any) {
      console.error('Profile resolution error:', error);
      
      // Even if we have errors, return the best information we have
      return NextResponse.json({
        did: userDid || 'unknown_did',
        handle: userHandle || 'unknown',
        error: error.message
      });
    }
  } catch (outerError: any) {
    console.error('Top-level profile fetch error:', outerError);
    
    // Fallback for any unexpected errors
    return NextResponse.json({
      did: 'unknown_did',
      handle: 'unknown',
      error: outerError.message
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