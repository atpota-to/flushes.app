import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { BskyAgent } from '@atproto/api';

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
    
    // Check if cache is still valid
    if (now - lastFetchTime < CACHE_TTL && cachedEntries.length > 0) {
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
        const authorHandle = await resolveDidToHandle(authorDid) || 'unknown';
        
        // Return the processed entry in the format the client expects
        return {
          id: entry.id,
          uri: entry.uri,
          cid: entry.cid,
          authorDid: authorDid,
          authorHandle: authorHandle,
          text: entry.text,
          emoji: entry.emoji,
          createdAt: entry.created_at
        } as ProcessedEntry;
      }));
      
      // Update the cache
      cachedEntries = processedEntries;
      lastFetchTime = now;
      
      return NextResponse.json({ entries: processedEntries });
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
  const mockEntries: ProcessedEntry[] = [
    {
      id: '1',
      uri: 'at://did:plc:12345/im.flushing.right.now/1',
      cid: 'bafyreiabc123',
      authorDid: 'did:plc:12345',
      authorHandle: 'alice.bsky.social',
      text: 'Taking a quick break at work',
      emoji: '🚽',
      createdAt: new Date(Date.now() - 15 * 60000).toISOString() // 15 minutes ago
    },
    {
      id: '2',
      uri: 'at://did:plc:67890/im.flushing.right.now/2',
      cid: 'bafyreiabc456',
      authorDid: 'did:plc:67890',
      authorHandle: 'bob.bsky.social',
      text: 'Reading the news on my phone',
      emoji: '📱',
      createdAt: new Date(Date.now() - 45 * 60000).toISOString() // 45 minutes ago
    },
    {
      id: '3',
      uri: 'at://did:plc:abcdef/im.flushing.right.now/3',
      cid: 'bafyreiabc789',
      authorDid: 'did:plc:abcdef',
      authorHandle: 'charlie.bsky.social',
      text: 'Just finished a great book chapter',
      emoji: '📚',
      createdAt: new Date(Date.now() - 120 * 60000).toISOString() // 2 hours ago
    }
  ];
  
  return mockEntries;
}

// Function to attempt to resolve a DID to a handle
// First tries PLC directory, then falls back to Bluesky API if needed
async function resolveDidToHandle(did: string): Promise<string | null> {
  try {
    // Try PLC directory first (faster and doesn't require auth)
    if (did && did.startsWith('did:plc:')) {
      const plcResponse = await fetch(`https://plc.directory/${did}/data`);
      if (plcResponse.ok) {
        const plcData = await plcResponse.json();
        if (plcData && plcData.alsoKnownAs && plcData.alsoKnownAs.length > 0) {
          // alsoKnownAs contains values like 'at://user.bsky.social'
          const handle = plcData.alsoKnownAs[0].split('//')[1];
          if (handle) return handle;
        }
      }
    }
    
    // Fall back to Bluesky API
    console.log(`Falling back to Bluesky API for DID: ${did}`);
    try {
      // Try to resolve DID directly with Bluesky API
      await agent.login({ identifier: 'user.bsky.social', password: 'none' });
      const response = await agent.getProfile({ actor: did });
      return response.data.handle;
    } catch (apiError) {
      console.error(`Failed to resolve handle with Bluesky API for DID ${did}:`, apiError);
      return null;
    }
  } catch (error) {
    console.error(`Failed to resolve handle for DID ${did}:`, error);
    return null;
  }
}