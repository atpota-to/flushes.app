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

// Define type for emoji statistics
interface EmojiStat {
  emoji: string;
  count: number;
}

// Define interface for profile response
interface ProfileResponse {
  entries: ProfileEntry[];
  count: number;
  cursor?: string;
  profile?: any;
  emojiStats?: EmojiStat[];
}

// Define approved emojis list - keep in sync with stats route
const APPROVED_EMOJIS = [
  '🚽', '🧻', '💩', '💨', '🚾', '🧼', '🪠', '🚻', '🩸', '💧', '💦', '😌', 
  '😣', '🤢', '🤮', '🥴', '😮‍💨', '😳', '😵', '🌾', '🍦', '📱', '📖', '💭',
  '1️⃣', '2️⃣', '🟡', '🟤'
];

const DEFAULT_API_URL = 'https://public.api.bsky.app/xrpc';
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
    
    // Special case for mackuba.eu - hardcoded workaround for third-party PDS
    if (handle === 'mackuba.eu') {
      console.log('SPECIAL CASE: mackuba.eu detected, using hardcoded solution');
      try {
        // Use public API to resolve the DID first
        const resolveResponse = await fetch(`https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=mackuba.eu`);
        if (!resolveResponse.ok) {
          return NextResponse.json({ error: 'Failed to resolve mackuba.eu handle' }, { status: resolveResponse.status });
        }
        
        const resolveData = await resolveResponse.json();
        const did = resolveData.did;
        
        // Get profile data
        const profileResponse = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=mackuba.eu`);
        let userProfile = null;
        if (profileResponse.ok) {
          userProfile = await profileResponse.json();
        }
        
        // Directly call the PDS we know works
        const directUrl = `https://lab.martianbase.net/xrpc/com.atproto.repo.listRecords?repo=${encodeURIComponent(did)}&collection=im.flushing.right.now&limit=50`;
        console.log(`Making direct request to: ${directUrl}`);
        
        const directResponse = await fetch(directUrl, {
          headers: { 'Accept': 'application/json' }
        });
        
        if (!directResponse.ok) {
          // If we get a 404, return empty data rather than error
          if (directResponse.status === 404) {
            return NextResponse.json({
              entries: [],
              count: 0,
              profile: userProfile,
              emojiStats: [],
              did,
              handle: 'mackuba.eu',
              directUrl,
              emptyCollection: true
            });
          }
          
          return NextResponse.json({ 
            error: `Failed to fetch mackuba.eu records: ${directResponse.statusText}`,
            directUrl
          }, { status: directResponse.status });
        }
        
        const recordsData = await directResponse.json();
        
        // Transform the records into our format
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
              text: sanitizeText(text),
              emoji: record.value.emoji || '🚽',
              created_at: record.value.createdAt
            };
          })
          .filter((entry: ProfileEntry | null): entry is ProfileEntry => entry !== null);
        
        // Calculate emoji statistics
        const emojiCounts = new Map<string, number>();
        
        // Process entries to count emojis
        transformedEntries.forEach((entry: ProfileEntry) => {
          const emoji = entry.emoji?.trim() || '🚽';
          if (APPROVED_EMOJIS.includes(emoji)) {
            emojiCounts.set(emoji, (emojiCounts.get(emoji) || 0) + 1);
          } else {
            emojiCounts.set('🚽', (emojiCounts.get('🚽') || 0) + 1);
          }
        });
        
        const emojiStats = Array.from(emojiCounts.entries())
          .map(([emoji, count]): EmojiStat => ({ emoji, count }))
          .sort((a, b) => b.count - a.count);
        
        return NextResponse.json({
          entries: transformedEntries,
          count: transformedEntries.length,
          cursor: recordsData.cursor,
          profile: userProfile,
          emojiStats,
          serviceEndpoint: 'https://lab.martianbase.net',
          directUrl,
          specialCase: true
        });
      } catch (specialErr: any) {
        console.error(`Error in special handling for mackuba.eu:`, specialErr);
        return NextResponse.json({
          error: `Special handling for mackuba.eu failed: ${specialErr.message}`,
          workingUrl: 'https://lab.martianbase.net/xrpc/com.atproto.repo.listRecords?repo=did:plc:oio4hkxaop4ao4wz2pp3f4cr&collection=im.flushing.right.now&limit=100'
        }, { status: 500 });
      }
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
        // Use public.api.bsky.app for handle resolution - this endpoint handles third-party PDS users better
        const resolveEndpoint = 'https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle';
        console.log(`Resolving handle ${handle} using ${resolveEndpoint}`);
        
        // Make request to public API endpoint
        const resolveResponse = await fetch(`${resolveEndpoint}?handle=${encodeURIComponent(handle)}`);
        
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
          // Also use public API for profile data to support third-party PDS users
          const profileResponse = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(did)}`);
          
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
    let serviceEndpoint = 'https://public.api.bsky.app'; // Start with public.api.bsky.app as fallback
    let servicePds: string | null = null; // Store the actual PDS domain for logging
    try {
      console.log(`Looking up PDS endpoint for DID: ${did}`);
      const plcResponse = await fetch(`https://plc.directory/${did}/data`);
      
      if (plcResponse.ok) {
        const plcData = await plcResponse.json();
        console.log(`Got PLC directory data for ${did}`);
        
        // Extract service endpoint from PLC data
        if (plcData && plcData.service) {
          // Find the atproto PDS service
          const pdsService = plcData.service.find((s: any) => 
            s.type === 'AtprotoPersonalDataServer' || s.type === 'AtprotoDataServer'
          );
          
          if (pdsService && pdsService.endpoint) {
            // Extract the full URL including subdomain for reference
            try {
              const serviceUrl = new URL(pdsService.endpoint);
              // Store the full hostname including subdomains
              servicePds = serviceUrl.hostname;
              // Use the full hostname for the service endpoint
              serviceEndpoint = `https://${servicePds}`;
              console.log(`Found PDS service for ${handle} at ${serviceEndpoint}`);
            } catch (e) {
              console.warn(`Could not parse service URL: ${pdsService.endpoint}`);
            }
          }
        }
      } else {
        console.warn(`PLC directory lookup failed for ${did}: ${plcResponse.status} ${plcResponse.statusText}`);
      }
    } catch (error: any) {
      console.warn(`Failed to get service endpoint from PLC directory: ${error.message}`);
      // Continue with default endpoint
    }
    
    // Step 3: Call the repo.listRecords API to get the user's flushing statuses
    try {
      // Add logging for debugging handle/domain/serviceEndpoint relationships
      console.log(`PROFILE DEBUG:
  - Handle: ${handle}
  - DID: ${did}
  - PDS Service Endpoint: ${serviceEndpoint}
  - Service PDS Host: ${servicePds || 'unknown'}
      `);
      
      // Construct the listRecords URL using the service endpoint
      const listRecordsUrl = `${serviceEndpoint}/xrpc/com.atproto.repo.listRecords?repo=${encodeURIComponent(did)}&collection=${encodeURIComponent(FLUSHING_STATUS_NSID)}&limit=${MAX_ENTRIES}`;
      
      console.log(`Fetching records from ${listRecordsUrl}`);
      
      const recordsResponse = await fetch(listRecordsUrl, {
        headers: {
          'Accept': 'application/json'
        }
      });
      
      if (!recordsResponse.ok) {
        // Log complete error information - this helps diagnose third-party PDS issues
        console.warn(`Failed to get records from ${serviceEndpoint}`);
        try {
          const errorText = await recordsResponse.text();
          console.error(`Error response from ${serviceEndpoint}: ${errorText}`);
        } catch (e) {
          console.error(`Could not read error response: ${e}`);
        }
        
        // If we have a servicePds from the PLC directory, try using it directly
        if (servicePds) {
          try {
            console.log(`Trying direct PDS domain: https://${servicePds}`);
            
            // Try multiple URL patterns for the PDS domain
            const urls = [
              `https://${servicePds}/xrpc/com.atproto.repo.listRecords?repo=${encodeURIComponent(did)}&collection=${encodeURIComponent(FLUSHING_STATUS_NSID)}&limit=${MAX_ENTRIES}`,
              // Try without /xrpc prefix in case it's already in the hostname
              `https://${servicePds}/com.atproto.repo.listRecords?repo=${encodeURIComponent(did)}&collection=${encodeURIComponent(FLUSHING_STATUS_NSID)}&limit=${MAX_ENTRIES}`
            ];
            
            let pdsDirectResponse: Response | null = null;
            let pdsDirectUrl = '';
            let directData: any = null;
            let succeeded = false;
            
            for (const url of urls) {
              try {
                console.log(`Attempting URL: ${url}`);
                pdsDirectUrl = url;
                pdsDirectResponse = await fetch(url, {
                  headers: { 'Accept': 'application/json' }
                });
                
                if (pdsDirectResponse.ok) {
                  console.log(`Success with URL: ${url}`);
                  directData = await pdsDirectResponse.json();
                  succeeded = true;
                  break;
                } else {
                  console.warn(`Failed with URL ${url}: ${pdsDirectResponse?.status || 'unknown status'}`);
                }
              } catch (urlErr) {
                console.error(`Error trying URL ${url}: ${urlErr}`);
              }
            }
            
            if (succeeded && directData) {
              console.log(`Successfully accessed records directly from PDS domain: ${servicePds}`);
              
              // Process the direct response
              const directEntries = directData.records
                .map((record: any) => {
                  const text = record.value.text || '';
                  if (containsBannedWords(text)) return null;
                  
                  return {
                    id: record.uri,
                    uri: record.uri,
                    cid: record.cid,
                    did: did,
                    text: sanitizeText(text),
                    emoji: record.value.emoji || '🚽',
                    created_at: record.value.createdAt
                  };
                })
                .filter((entry: ProfileEntry | null): entry is ProfileEntry => entry !== null);
              
              // Calculate emoji stats
              const directEmojiCounts = new Map<string, number>();
              directEntries.forEach((entry: ProfileEntry) => {
                const emoji = entry.emoji?.trim() || '🚽';
                if (APPROVED_EMOJIS.includes(emoji)) {
                  directEmojiCounts.set(emoji, (directEmojiCounts.get(emoji) || 0) + 1);
                } else {
                  directEmojiCounts.set('🚽', (directEmojiCounts.get('🚽') || 0) + 1);
                }
              });
              
              const directEmojiStats = Array.from(directEmojiCounts.entries())
                .map(([emoji, count]): EmojiStat => ({ emoji, count }))
                .sort((a, b) => b.count - a.count);
              
              return NextResponse.json({
                entries: directEntries,
                count: directEntries.length,
                cursor: directData.cursor,
                profile: userProfile,
                emojiStats: directEmojiStats,
                serviceEndpoint: `https://${servicePds}`,
                directPds: true
              });
            } else if (pdsDirectResponse) {
              try {
                const errorText = await pdsDirectResponse.text();
                console.warn(`PDS direct access failed: ${errorText}`);
              } catch (e) {
                console.warn(`PDS direct access failed: Could not read response text`);
              }
            } else {
              console.warn(`PDS direct access failed: No valid response`);
            }
          } catch (pdsErr) {
            console.error(`Error with direct PDS domain access: ${pdsErr}`);
          }
        }
        
        // If all attempts fail, return error
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
      
      // Calculate emoji statistics
      const emojiCounts = new Map<string, number>();
      
      // Process entries to count emojis
      transformedEntries.forEach((entry: ProfileEntry) => {
        if (entry.emoji) {
          // Default to toilet emoji if empty
          const emoji = entry.emoji.trim() || '🚽';
          // Only count approved emojis
          if (APPROVED_EMOJIS.includes(emoji)) {
            emojiCounts.set(emoji, (emojiCounts.get(emoji) || 0) + 1);
          } else {
            // Count as default toilet emoji if not approved
            emojiCounts.set('🚽', (emojiCounts.get('🚽') || 0) + 1);
          }
        } else {
          // Count default toilet emoji if no emoji specified
          emojiCounts.set('🚽', (emojiCounts.get('🚽') || 0) + 1);
        }
      });
      
      // Convert to array and sort by count (most popular first)
      const emojiStats = Array.from(emojiCounts.entries())
        .map(([emoji, count]): EmojiStat => ({ emoji, count }))
        .sort((a, b) => b.count - a.count);
      
      return NextResponse.json({
        entries: transformedEntries,
        count: transformedEntries.length,
        cursor: recordsData.cursor,
        profile: userProfile,
        emojiStats,
        serviceEndpoint, // Include the endpoint we used for debugging
        servicePds // Include the extracted PDS domain
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
        
        // Calculate emoji statistics for Supabase fallback entries
        const emojiCounts = new Map<string, number>();
        
        // Process entries to count emojis
        filteredEntries.forEach((entry: any) => {
          if (entry.emoji) {
            // Default to toilet emoji if empty
            const emoji = entry.emoji.trim() || '🚽';
            // Only count approved emojis
            if (APPROVED_EMOJIS.includes(emoji)) {
              emojiCounts.set(emoji, (emojiCounts.get(emoji) || 0) + 1);
            } else {
              // Count as default toilet emoji if not approved
              emojiCounts.set('🚽', (emojiCounts.get('🚽') || 0) + 1);
            }
          } else {
            // Count default toilet emoji if no emoji specified
            emojiCounts.set('🚽', (emojiCounts.get('🚽') || 0) + 1);
          }
        });
        
        // Convert to array and sort by count (most popular first)
        const emojiStats = Array.from(emojiCounts.entries())
          .map(([emoji, count]): EmojiStat => ({ emoji, count }))
          .sort((a, b) => b.count - a.count);
        
        return NextResponse.json({
          entries: filteredEntries,
          count: filteredEntries.length, // Update count to reflect filtered entries
          profile: userProfile,
          emojiStats,
          source: 'supabase', // Record the data source
          did
        });
      }
      
      // If we get a 404, return empty entries rather than an error
      // This handles PDS servers that return 404 instead of empty arrays
      if (error instanceof Error && error.message.includes('404')) {
        console.log(`Returning empty entries list instead of 404 error for ${did}`);
        return NextResponse.json({
          entries: [],
          count: 0,
          profile: userProfile,
          emojiStats: [],
          did,
          handle,
          serviceEndpoint,
          servicePds,
          emptyCollection: true
        });
      }
      
      return NextResponse.json(
        { 
          error: `Failed to fetch records: ${error.message}`,
          did,
          handle,
          serviceEndpoint,
          servicePds
        },
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
        // Use public.api.bsky.app for resolving handles to DIDs - better support for third-party PDS
        const resolveResponse = await fetch(`https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(resolveHandle)}`);
        
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
        if (pdsEndpoint && pdsEndpoint !== 'https://public.api.bsky.app' && data.handle) {
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