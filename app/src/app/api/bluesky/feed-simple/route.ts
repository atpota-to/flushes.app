import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { containsBannedWords, sanitizeText } from '@/lib/content-filter';

// Configure this route as dynamic to prevent any caching
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
  handle?: string;
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
const MAX_ENTRIES = 20;

// Supabase client - using environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export async function GET(request: NextRequest) {
  // Debug log the incoming request
  console.log(`\n=== SIMPLE FEED REQUEST @ ${new Date().toISOString()} ===`);
  console.log(`URL: ${request.url}`);
  
  try {
    const url = new URL(request.url);
    const beforeCursor = url.searchParams.get('before');
    
    console.log(`Request params: beforeCursor=${beforeCursor || 'none'}`);
    
    // If we don't have Supabase credentials, return an error
    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing Supabase credentials');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }
    
    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Show highest ID in database for debugging
    const { data: maxIdResult } = await supabase
      .from('flushing_records')
      .select('id')
      .order('id', { ascending: false })
      .limit(1);
      
    console.log('Highest ID in database:', maxIdResult?.[0]?.id || 'unknown');
    
    let entries: FlushingRecord[] = [];
    
    if (beforeCursor) {
      // Pagination query: get entries older than the cursor
      console.log(`Fetching entries older than ID ${beforeCursor}`);
      
      const { data, error } = await supabase
        .from('flushing_records')
        .select('*')
        .lt('id', beforeCursor)
        .order('id', { ascending: false })
        .limit(MAX_ENTRIES);
        
      if (error) {
        throw new Error(`Database query error: ${error.message}`);
      }
      
      entries = data || [];
    } else {
      // Main query: get the most recent entries
      console.log('Fetching latest entries');
      
      // Standard query approach - simplest and most reliable
      const { data, error } = await supabase
        .from('flushing_records')
        .select('*')
        .order('id', { ascending: false })
        .limit(MAX_ENTRIES);
        
      if (error) {
        throw new Error(`Database query error: ${error.message}`);
      }
      
      entries = data || [];
    }
    
    console.log(`Query returned ${entries.length} entries`);
    
    if (entries.length > 0) {
      console.log('Top 5 entries:');
      for (let i = 0; i < Math.min(5, entries.length); i++) {
        const entry = entries[i];
        console.log(`  ${i+1}. ID: ${entry.id}, Handle: ${entry.handle || 'unknown'}, Text: "${entry.text.substring(0, 20)}..."`);
      }
    } else {
      console.warn('No entries found - this may indicate a database problem');
    }
    
    // Process entries for the client
    const processedEntries = entries.map((entry) => {
      // Skip entries with banned content
      if (containsBannedWords(entry.text)) {
        return null;
      }
      
      // Use the handle from the database, or extract from DID as fallback
      const authorHandle = entry.handle || 
        (entry.did.startsWith('did:plc:') ? 
          `${entry.did.substring(8, 16)}...` : 
          `${entry.did.substring(0, 8)}...`);
      
      // Return processed entry
      return {
        id: entry.id,
        uri: entry.uri,
        cid: entry.cid,
        authorDid: entry.did,
        authorHandle: authorHandle,
        text: sanitizeText(entry.text),
        emoji: entry.emoji,
        createdAt: entry.created_at
      } as ProcessedEntry;
    });
    
    // Filter out null entries (those with banned content)
    const filteredEntries = processedEntries.filter((entry): entry is ProcessedEntry => entry !== null);
    
    // Return the processed entries
    return NextResponse.json({ 
      entries: filteredEntries,
      source: 'simple-query'
    });
  } catch (error: any) {
    console.error('Error in simple feed API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch feed', message: error.message },
      { status: 500 }
    );
  }
}