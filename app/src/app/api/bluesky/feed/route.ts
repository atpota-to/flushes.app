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
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds
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
  try {
    const now = Date.now();
    const url = new URL(request.url);
    const forceRefresh = url.searchParams.get('refresh') === 'true';
    const beforeCursor = url.searchParams.get('before');
    
    // If we have a 'before' cursor, we're paginating and shouldn't use the cache
    if (beforeCursor) {
      console.log('Pagination request with cursor:', beforeCursor);
      
      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey);
        
        // Find the record that matches the cursor ID
        const { data: cursorRecord, error: cursorError } = await supabase
          .from('flushing_records')
          .select('created_at')
          .eq('id', beforeCursor)
          .single();
        
        if (cursorError) {
          console.error('Error finding cursor record:', cursorError);
          // If cursor record not found, just return empty results
          return NextResponse.json({ entries: [] });
        }
        
        // Fetch entries older than the cursor timestamp
        const { data: entries, error } = await supabase
          .from('flushing_records')
          .select(`
            id,
            uri,
            cid,
            did,
            text,
            emoji,
            created_at
          `)
          .lt('created_at', cursorRecord.created_at) // Get entries older than cursor
          .order('created_at', { ascending: false })
          .limit(MAX_ENTRIES);
          
        if (error) {
          throw new Error(`Supabase error: ${error.message}`);
        }
        
        // Process and return older entries (skip caching)
        const processedEntries = await Promise.all((entries || []).map(async (entry: FlushingRecord) => {
          const authorDid = entry.did;
          const authorHandle = await resolveDidToHandle(authorDid);
          
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
    
    // For normal (non-pagination) requests, use the cache if valid
    if (!forceRefresh && now - lastFetchTime < CACHE_TTL && cachedEntries.length > 0) {
      console.log('Returning cached entries');
      return NextResponse.json({ entries: cachedEntries });
    }
    
    console.log('Fetching fresh entries');
    
    // If we have Supabase credentials, fetch from there
    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      // Fetch entries from the flushing_records table
      const { data: entries, error } = await supabase
        .from('flushing_records')
        .select(`
          id,
          uri,
          cid,
          did,
          text,
          emoji,
          created_at
        `)
        .order('created_at', { ascending: false })
        .limit(MAX_ENTRIES);
      
      if (error) {
        throw new Error(`Supabase error: ${error.message}`);
      }
      
      // Transform the data to match our client-side model
      const processedEntries = await Promise.all((entries || []).map(async (entry: FlushingRecord) => {
        // Resolve handle from DID
        const authorDid = entry.did;
        const authorHandle = await resolveDidToHandle(authorDid);
        
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

// Function to attempt to resolve a DID to a handle
// First tries PLC directory, then tries Bluesky API as a fallback
async function resolveDidToHandle(did: string): Promise<string> {
  try {
    // Create a fallback shortened DID to use if all else fails
    const shortDid = did.startsWith('did:plc:') ? 
      `${did.substring(0, 13)}...` : 
      `${did.substring(0, 10)}...`;
    
    // Try PLC directory first - most reliable and doesn't require auth
    if (did && did.startsWith('did:plc:')) {
      try {
        console.log(`Trying PLC directory for DID: ${did}`);
        const plcResponse = await fetch(`https://plc.directory/${did}`);
        
        if (plcResponse.ok) {
          const plcData = await plcResponse.json();
          if (plcData && plcData.alsoKnownAs && plcData.alsoKnownAs.length > 0) {
            // alsoKnownAs contains values like 'at://user.bsky.social'
            for (const aka of plcData.alsoKnownAs) {
              if (aka.startsWith('at://')) {
                const handle = aka.split('//')[1];
                if (handle) {
                  console.log(`Resolved ${did} to handle ${handle} via PLC directory`);
                  return handle;
                }
              }
            }
          }
        }
        
        // Try alternate PLC directory endpoint format
        const altPlcResponse = await fetch(`https://plc.directory/${did}/data`);
        if (altPlcResponse.ok) {
          const altPlcData = await altPlcResponse.json();
          if (altPlcData && altPlcData.alsoKnownAs && altPlcData.alsoKnownAs.length > 0) {
            for (const aka of altPlcData.alsoKnownAs) {
              if (aka.startsWith('at://')) {
                const handle = aka.split('//')[1];
                if (handle) {
                  console.log(`Resolved ${did} to handle ${handle} via PLC directory (alternate endpoint)`);
                  return handle;
                }
              }
            }
          }
        }
      } catch (plcError) {
        console.warn(`Failed to resolve handle from PLC directory for DID ${did}:`, plcError);
        // Continue to next method
      }
    }
    
    // Fall back to Bluesky API
    console.log(`Falling back to Bluesky API for DID: ${did}`);
    try {
      // Try to resolve DID directly with Bluesky API
      await agent.login({ identifier: '', password: '' });
      const response = await agent.getProfile({ actor: did });
      if (response?.data?.handle) {
        console.log(`Resolved ${did} to handle ${response.data.handle} via Bluesky API`);
        return response.data.handle;
      }
    } catch (apiError) {
      console.error(`Failed to resolve handle with Bluesky API for DID ${did}:`, apiError);
    }
    
    // If we get here, all resolution methods failed
    console.log(`All resolution methods failed for ${did}, using shortened DID: ${shortDid}`);
    return shortDid;
  } catch (error) {
    console.error(`Failed to resolve handle for DID ${did}:`, error);
    // Last resort fallback is the shortened DID
    const shortDid = did.startsWith('did:plc:') ? 
      `${did.substring(0, 13)}...` : 
      `${did.substring(0, 10)}...`;
    return shortDid;
  }
}