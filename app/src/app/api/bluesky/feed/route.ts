import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { BskyAgent } from '@atproto/api';
import { containsBannedWords, sanitizeText } from '@/lib/content-filter';

// Configure this route as dynamic to fix static generation issues
export const dynamic = 'force-dynamic';

// Define type for our database entry
interface FlushingRecord {
  id: string | number;
  uri: string;
  cid: string;
  did: string;
  text: string;
  emoji: string;
  created_at: string;
  handle?: string; // Optional handle field from the database
}

// Type for the processed entry for the client
interface ProcessedEntry {
  id: string | number;
  uri: string;
  cid: string;
  authorDid: string;
  authorHandle: string;
  text: string;
  emoji: string;
  createdAt: string;
}

// Constants
const FLUSHING_STATUS_NSID = 'im.flushing.right.now';
const MAX_ENTRIES = 20;

// Cache settings to avoid hitting the database too frequently
const CACHE_TTL = 1 * 60 * 1000; // 1 minute in milliseconds (reduced from 5 min)
let cachedEntries: ProcessedEntry[] = [];
let lastFetchTime = 0;

// Supabase client - using environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Bluesky agent for public interactions (used to resolve DIDs to handles if needed)
const agent = new BskyAgent({
  service: 'https://bsky.social'
});

export async function GET(request: NextRequest) {
  // Debug log all incoming requests with timestamp
  const requestTime = new Date().toISOString();
  console.log(`\n=== FEED REQUEST @ ${requestTime} ===`);
  console.log(`URL: ${request.url}`);
  console.log(`Headers: ${JSON.stringify(Object.fromEntries(request.headers))}`);
  
  try {
    const now = Date.now();
    const url = new URL(request.url);
    const forceRefresh = url.searchParams.get('refresh') === 'true';
    const beforeCursor = url.searchParams.get('before');
    
    console.log(`Request params: forceRefresh=${forceRefresh}, beforeCursor=${beforeCursor || 'none'}`);
    console.log(`Current time: ${new Date(now).toISOString()}`);
    console.log(`Current cache age: ${now - lastFetchTime}ms, TTL: ${CACHE_TTL}ms`);
    console.log(`Cached entries count: ${cachedEntries.length}`);
    console.log(`DID resolution cache size: ${didResolutionCache.size}`);
    console.log(`DB handle cache size: ${dbHandleCache.size}`);
    console.log('=== END REQUEST INFO ===');
    
    // If we have a 'before' cursor, we're paginating and shouldn't use the cache
    if (beforeCursor) {
      console.log('Pagination request with cursor:', beforeCursor);
      
      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey);
        
        // Debug: find the record that matches the cursor ID
        const { data: cursorRecord, error: cursorError } = await supabase
          .from('flushing_records')
          .select('id, created_at')
          .eq('id', beforeCursor)
          .single();
        
        if (cursorError) {
          console.error('Error finding cursor record:', cursorError);
          // If cursor record not found, just return empty results
          return NextResponse.json({ entries: [] });
        }
        
        // Fetch entries with IDs less than the cursor ID (older entries)
        console.log(`Fetching entries older than ID ${beforeCursor}`);
        
        // Enhanced query for entries older than the cursor
        const { data: entries, error } = await supabase
          .from('flushing_records')
          .select('*')
          .lt('id', beforeCursor) // Get entries older than cursor by ID
          .order('id', { ascending: false }) // Order by ID to get newest first
          .limit(MAX_ENTRIES);
          
        if (error) {
          throw new Error(`Supabase error: ${error.message}`);
        }
        
        console.log(`Found ${entries?.length || 0} older entries`);
        if (entries && entries.length > 0) {
          console.log(`Oldest ID in batch: ${entries[entries.length-1].id}, Newest ID in batch: ${entries[0].id}`);
        }
        
        // Process and return older entries (skip caching)
        const processedEntries = await Promise.all((entries || []).map(async (entry: FlushingRecord) => {
          // Get the DID
          const authorDid = entry.did;
          
          // Determine the best handle to use
          let authorHandle: string;
          
          // First check if we have a valid handle in the database record
          // and it's not "unknown"
          if (entry.handle && entry.handle !== 'unknown') {
            // Use the handle from the database
            authorHandle = entry.handle;
            console.log(`Using handle from database for ${authorDid}: ${authorHandle}`);
            
            // Store in cache for future use
            dbHandleCache.set(authorDid, authorHandle);
          } 
          // Next, check if we have it in the cache
          else if (dbHandleCache.has(authorDid)) {
            // Use cached handle from previous database entries
            authorHandle = dbHandleCache.get(authorDid)!;
            console.log(`Using cached DB handle for ${authorDid}: ${authorHandle}`);
          } 
          // If not in database or cache, try to resolve it
          else {
            // Try to resolve the handle from PLC directory
            const resolvedHandle = await resolveDidToHandle(authorDid);
            
            // Only use the resolved handle if it's not in the user.xyz format (our fallback format)
            if (!resolvedHandle.startsWith('user.')) {
              authorHandle = resolvedHandle;
              console.log(`Successfully resolved handle for ${authorDid}: ${authorHandle}`);
              
              // Also update the database with the resolved handle if possible
              try {
                if (supabaseUrl && supabaseKey) {
                  const supabase = createClient(supabaseUrl, supabaseKey);
                  // Update all records with this DID to have the correct handle
                  const { error: updateError } = await supabase
                    .from('flushing_records')
                    .update({ handle: authorHandle })
                    .eq('did', authorDid);
                    
                  if (updateError) {
                    console.error(`Error updating handle in DB: ${updateError.message}`);
                  } else {
                    console.log(`✅ Updated database with resolved handle for ${authorDid}: ${authorHandle}`);
                    
                    // For DEBUG - check if our update worked
                    const { data: dbData } = await supabase
                      .from('flushing_records')
                      .select('id, did, handle, text, created_at')
                      .eq('did', authorDid)
                      .limit(1);
                      
                    console.log(`Current DB data for ${authorDid} after update:`, dbData);
                  }
                }
              } catch (updateError) {
                console.error(`Failed to update handle in database for ${authorDid}:`, updateError);
              }
            } else {
              // If resolution failed, still use the resolved handle (which will be our fallback format)
              authorHandle = resolvedHandle;
              console.log(`Could not resolve real handle for ${authorDid}, using: ${authorHandle}`);
            }
          }
          
          if (containsBannedWords(entry.text)) {
            return null;
          }
          
          return {
            id: entry.id,
            uri: entry.uri,
            cid: entry.cid,
            authorDid: authorDid,
            authorHandle: authorHandle,
            text: sanitizeText(entry.text),
            emoji: entry.emoji,
            createdAt: entry.created_at
          } as ProcessedEntry;
        }));
        
        const filteredEntries = processedEntries.filter((entry): entry is ProcessedEntry => entry !== null);
        return NextResponse.json({ entries: filteredEntries });
      } else {
        // For mock data with pagination, just return empty results
        return NextResponse.json({ entries: [] });
      }
    }
    
    // IMPORTANT: We're disabling the cache completely to ensure we always get fresh data
    // This is because we're having issues with stale data
    if (false && !forceRefresh && now - lastFetchTime < CACHE_TTL && cachedEntries.length > 0) {
      console.log('Returning cached entries');
      return NextResponse.json({ entries: cachedEntries });
    }
    
    // Clear the DID resolution cache on every request to ensure fresh resolution
    console.log('Clearing DID resolution cache to force fresh handle resolution');
    didResolutionCache.clear();
    
    console.log('Fetching fresh entries');
    
    // If we have Supabase credentials, fetch from there
    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      // Fetch entries from the flushing_records table
      console.log(`Querying database for latest ${MAX_ENTRIES} entries at ${new Date().toISOString()}...`);
      
      // Debug log the SQL query we're about to execute
      console.log('SQL Query: SELECT id, uri, cid, did, text, emoji, created_at, handle FROM flushing_records ORDER BY created_at DESC LIMIT 20');
      
      // First, let's check what's the highest ID in the database to debug
      const { data: maxIdResult } = await supabase
        .from('flushing_records')
        .select('id')
        .order('id', { ascending: false })
        .limit(1);
        
      console.log('Highest ID in database:', maxIdResult?.[0]?.id || 'unknown');
      
      // Now let's check what's the latest timestamp in the database
      const { data: latestTimestampResult } = await supabase
        .from('flushing_records')
        .select('id, created_at')
        .order('created_at', { ascending: false })
        .limit(1);
        
      console.log('Latest timestamp in database:', 
        latestTimestampResult?.[0]?.id 
          ? `ID ${latestTimestampResult[0].id} at ${latestTimestampResult[0].created_at}` 
          : 'unknown');
      
      // Try multiple query approaches to ensure we get the most recent data
      console.log('Executing direct query to ensure we get the absolute latest data');
      
      let entries;
      
      try {
        // First try: Get entries with highest IDs
        const { data: idSortedEntries, error: idSortError } = await supabase
          .from('flushing_records')
          .select('*')
          .order('id', { ascending: false })
          .limit(MAX_ENTRIES);
        
        if (idSortError) {
          throw idSortError;
        }
        
        if (idSortedEntries && idSortedEntries.length > 0) {
          console.log('✅ ID-sorted query successful');
          console.log(`ID-sorted query found entries with IDs: ${idSortedEntries.slice(0, 5).map(e => e.id).join(', ')}...`);
          entries = idSortedEntries;
        } else {
          console.warn('⚠️ ID-sorted query returned no entries');
        }
      } catch (err) {
        console.error('❌ Error with ID-sorted query:', err);
      }
      
      // If first query failed, try a different approach
      if (!entries) {
        try {
          // Second try: Get entries with newest timestamps
          const { data: timeSortedEntries, error: timeSortError } = await supabase
            .from('flushing_records')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(MAX_ENTRIES);
          
          if (timeSortError) {
            throw timeSortError;
          }
          
          if (timeSortedEntries && timeSortedEntries.length > 0) {
            console.log('✅ Time-sorted query successful');
            console.log(`Time-sorted query found entries with IDs: ${timeSortedEntries.slice(0, 5).map(e => e.id).join(', ')}...`);
            entries = timeSortedEntries;
          } else {
            console.warn('⚠️ Time-sorted query returned no entries');
          }
        } catch (err) {
          console.error('❌ Error with time-sorted query:', err);
        }
      }
      
      // If still no entries, try a last approach
      if (!entries) {
        console.log('⚠️ All previous queries failed, trying basic query');
        const { data: basicEntries, error: basicError } = await supabase
          .from('flushing_records')
          .select('*')
          .limit(MAX_ENTRIES);
          
        if (basicError) {
          throw new Error(`Basic query error: ${basicError.message}`);
        }
        
        entries = basicEntries || [];
      }
      
      // Safety check
      if (!entries) {
        entries = [];
      }
      
      console.log(`Final query found ${entries.length} entries`);
      if (entries.length > 0) {
        console.log(`Highest ID: ${entries[0].id}, Latest timestamp: ${entries[0].created_at}`);
      }
      
      // Error already handled in the try/catch blocks above
      
      console.log(`Retrieved ${entries?.length || 0} entries from database.`);
      
      // If entries found, log the most recent ones for debugging
      if (entries && entries.length > 0) {
        console.log('Latest entry:', {
          id: entries[0].id,
          did: entries[0].did,
          handle: entries[0].handle,
          text: entries[0].text.substring(0, 30) + (entries[0].text.length > 30 ? '...' : ''),
          created_at: entries[0].created_at
        });
        
        // Debug: log the 5 most recent entries
        console.log('Recent entries:');
        for (let i = 0; i < Math.min(5, entries.length); i++) {
          console.log(`  ${i+1}. [${entries[i].id}] ${entries[i].did.substring(0, 20)}... - "${entries[i].text.substring(0, 20)}..." (${entries[i].created_at})`);
        }
      } else {
        console.warn('No entries found in database - this may indicate a problem');
      }
      
      // Transform the data to match our client-side model
      const processedEntries = await Promise.all((entries || []).map(async (entry: FlushingRecord) => {
        // Get the DID
        const authorDid = entry.did;
        
        // Determine the best handle to use
        let authorHandle: string;
        
        // First check if we have a valid handle in the database record
        // and it's not "unknown"
        if (entry.handle && entry.handle !== 'unknown') {
          // Use the handle from the database
          authorHandle = entry.handle;
          console.log(`Using handle from database for ${authorDid}: ${authorHandle}`);
          
          // Store in cache for future use
          dbHandleCache.set(authorDid, authorHandle);
        } 
        // Next, check if we have it in the cache
        else if (dbHandleCache.has(authorDid)) {
          // Use cached handle from previous database entries
          authorHandle = dbHandleCache.get(authorDid)!;
          console.log(`Using cached DB handle for ${authorDid}: ${authorHandle}`);
        } 
        // If not in database or cache, try to resolve it
        else {
          // Try to resolve the handle from PLC directory
          const resolvedHandle = await resolveDidToHandle(authorDid);
          
          // Only use the resolved handle if it's not in the user.xyz format (our fallback format)
          if (!resolvedHandle.startsWith('user.')) {
            authorHandle = resolvedHandle;
            console.log(`Successfully resolved handle for ${authorDid}: ${authorHandle}`);
            
            // Also update the database with the resolved handle if possible
            try {
              if (supabaseUrl && supabaseKey) {
                const supabase = createClient(supabaseUrl, supabaseKey);
                await supabase
                  .from('flushing_records')
                  .update({ handle: authorHandle })
                  .eq('did', authorDid);
                console.log(`Updated database with resolved handle for ${authorDid}: ${authorHandle}`);
              }
            } catch (updateError) {
              console.error(`Failed to update handle in database for ${authorDid}:`, updateError);
            }
          } else {
            // If resolution failed, still use the resolved handle (which will be our fallback format)
            authorHandle = resolvedHandle;
            console.log(`Could not resolve real handle for ${authorDid}, using: ${authorHandle}`);
          }
        }
        
        // Skip entries with banned content
        if (containsBannedWords(entry.text)) {
          return null;
        }
        
        // Sanitize text just in case
        const sanitizedText = sanitizeText(entry.text);
        
        // Return the processed entry in the format the client expects
        return {
          id: entry.id,
          uri: entry.uri,
          cid: entry.cid,
          authorDid: authorDid,
          authorHandle: authorHandle,
          text: sanitizedText, // Use sanitized text
          emoji: entry.emoji,
          createdAt: entry.created_at
        } as ProcessedEntry;
      }));
      
      // Filter out null entries (those with banned content) and update the cache
      const filteredEntries = processedEntries.filter((entry): entry is ProcessedEntry => entry !== null);
      cachedEntries = filteredEntries;
      lastFetchTime = now;
      
      return NextResponse.json({ entries: filteredEntries });
    } else {
      // If no Supabase credentials, fall back to mock data
      console.log('No Supabase credentials, using mock data');
      const mockEntries = getMockEntries();
      
      // Update cache
      cachedEntries = mockEntries;
      lastFetchTime = now;
      
      return NextResponse.json({ entries: mockEntries });
    }
  } catch (error: any) {
    console.error('Error fetching feed:', error);
    return NextResponse.json(
      { error: 'Failed to fetch feed', message: error.message },
      { status: 500 }
    );
  }
}

// Function to generate mock entries for testing
// This is used when Supabase is not configured
function getMockEntries(): ProcessedEntry[] {
  // Create some mock entries for testing
  const mockTexts = [
    'is taking a quick break at work',
    'is reading the news on my phone',
    'is scrolling through bluesky',
    'is just finished a great book chapter',
    'is getting some alone time',
    'is answering nature\'s call',
    'is contemplating life decisions'
  ];
  
  // Create and filter mock entries
  const mockEntries: ProcessedEntry[] = [];
  const handles = ['alice.bsky.social', 'bob.bsky.social', 'charlie.bsky.social', 'dana.bsky.social'];
  const emojis = ['🚽', '📱', '📚', '💩', '🧻', '💭', '😌'];
  
  for (let i = 0; i < 6; i++) {
    const text = mockTexts[i % mockTexts.length];
    
    // Skip any mock entries that might contain banned words
    if (containsBannedWords(text)) {
      continue;
    }
    
    mockEntries.push({
      id: `mock${i + 1}`,
      uri: `at://did:plc:mock${i + 1}/im.flushing.right.now/${i + 1}`,
      cid: `bafyreiabc${i + 100}`,
      authorDid: `did:plc:mock${i + 1}`,
      authorHandle: handles[i % handles.length],
      text: sanitizeText(text), // Apply sanitization to be extra safe
      emoji: emojis[i % emojis.length],
      createdAt: new Date(Date.now() - (i + 1) * 15 * 60000).toISOString() // Staggered times
    });
  }
  
  return mockEntries;
}

// DID resolution cache
const didResolutionCache = new Map<string, string>();

// Handle column cache - maps DID to handle stored in the database
// This allows us to use existing handle values from the DB instead of resolving every time
const dbHandleCache = new Map<string, string>();

// Timeout promise to prevent hanging on API calls
function timeout(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`Operation timed out after ${ms}ms`)), ms);
  });
}

// Direct fetch from PLC directory to resolve a DID to a handle
// This is a simplified implementation that tries to be as reliable as possible
async function resolveDidToHandle(did: string): Promise<string> {
  try {
    // Check if we have a cached result for this DID
    if (didResolutionCache.has(did)) {
      return didResolutionCache.get(did)!;
    }
    
    console.log(`Resolving handle for DID: ${did}`);
    
    // Create a fallback in case resolution fails
    const fallbackHandle = did.startsWith('did:plc:') ? 
      did.substring(8, 20) : 
      did.substring(0, 12);
    
    // Only try PLC directory for did:plc DIDs
    if (did && did.startsWith('did:plc:')) {
      try {
        // Fetch directly from PLC directory with a simple GET request
        const url = `https://plc.directory/${did}`;
        console.log(`Fetching from ${url}`);
        
        const plcResponse = await fetch(url, { 
          method: 'GET',
          // No signal/timeout here to ensure we get a response
        });
        
        if (plcResponse.ok) {
          const plcData = await plcResponse.json();
          
          // Debug: Log the entire response for diagnosis
          console.log(`Full PLC data for ${did}:`, JSON.stringify(plcData));
          
          // Extract handle from alsoKnownAs if it exists
          if (plcData && plcData.alsoKnownAs && Array.isArray(plcData.alsoKnownAs)) {
            // Find the first entry that starts with "at://"
            for (const aka of plcData.alsoKnownAs) {
              if (typeof aka === 'string' && aka.startsWith('at://')) {
                // Extract the handle portion (after "at://")
                const handle = aka.substring(5); // "at://".length === 5
                
                if (handle && handle.length > 0) {
                  console.log(`✅ Successfully resolved ${did} to handle: ${handle}`);
                  
                  // Cache it for future use
                  didResolutionCache.set(did, handle);
                  
                  // Return the resolved handle
                  return handle;
                }
              }
            }
          }
          
          console.warn(`❌ Could not find handle in PLC data for ${did}`);
        } else {
          console.warn(`❌ PLC fetch failed: ${plcResponse.status} ${plcResponse.statusText}`);
        }
      } catch (error) {
        console.error(`❌ Error fetching from PLC directory:`, error);
      }
    }
    
    // Fall back to Bluesky API
    try {
      console.log(`Trying Bluesky API for DID: ${did}`);
      
      // Create a new agent for this request
      const agent = new BskyAgent({
        service: 'https://bsky.social'
      });
      
      // Log in with empty credentials (still required by the API)
      await agent.login({ identifier: '', password: '' });
      
      // Get the profile
      const response = await agent.getProfile({ actor: did });
      
      if (response && response.success && response.data && response.data.handle) {
        const handle = response.data.handle;
        console.log(`✅ Successfully resolved ${did} to handle via Bluesky API: ${handle}`);
        
        // Cache it for future use
        didResolutionCache.set(did, handle);
        
        // Return the resolved handle
        return handle;
      } else {
        console.warn(`❌ Bluesky API resolution failed for ${did}`);
      }
    } catch (apiError) {
      console.error(`❌ Error with Bluesky API:`, apiError);
    }
    
    // If all resolution methods failed, use the fallback
    console.log(`❌ All resolution methods failed for ${did}, using fallback: ${fallbackHandle}`);
    didResolutionCache.set(did, fallbackHandle);
    return fallbackHandle;
  } catch (error) {
    console.error(`❌ Unexpected error resolving handle for ${did}:`, error);
    return did.substring(0, 12); // Last resort fallback
  }
}