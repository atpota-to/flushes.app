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

// Helper function to process database entries into client-friendly format
async function processEntries(entries: FlushingRecord[]): Promise<ProcessedEntry[]> {
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
  return processedEntries.filter((entry): entry is ProcessedEntry => entry !== null);
}

export async function GET(request: NextRequest) {
  // Debug log the incoming request
  console.log(`\n=== DIRECT FEED REQUEST @ ${new Date().toISOString()} ===`);
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
      // First try: Direct raw SQL query via executeRaw (most reliable)
      try {
        // Use a direct SQL query to completely bypass any ORM and query builder caching
        const rawQuery = `
          SELECT * FROM flushing_records 
          ORDER BY id DESC 
          LIMIT ${MAX_ENTRIES}
        `;
        
        console.log('Executing direct SQL query:', rawQuery);
        
        const { data: directData, error: directError } = await supabase.rpc(
          'execute_raw_query', 
          { raw_query: rawQuery }
        );
        
        if (directError) {
          console.error('Raw SQL query error:', directError);
          // Continue to next approach
        } else if (directData && Array.isArray(directData) && directData.length > 0) {
          console.log(`✅ Direct SQL query successful, found ${directData.length} entries`);
          entries = directData;
          
          // We got data - process and return as NextResponse
          const processedEntries = await processEntries(entries);
          return NextResponse.json({
            entries: processedEntries,
            source: 'direct-sql'
          });
        }
      } catch (rawError) {
        console.error('Exception executing raw SQL:', rawError);
        // Continue to next approach
      }
      
      // Second try: Using the RPC function approach
      try {
        console.log('Trying RPC function approach');
        
        const { data, error } = await supabase.rpc('get_latest_entries', {
          max_entries: MAX_ENTRIES
        });
        
        if (error) {
          console.error('RPC function error:', error);
          // Continue to fallback approach
        } else if (data && Array.isArray(data) && data.length > 0) {
          console.log(`✅ RPC function query successful, found ${data.length} entries`);
          entries = data;
          
          // We got data - process and return as NextResponse
          const processedEntries = await processEntries(entries);
          return NextResponse.json({
            entries: processedEntries,
            source: 'rpc-function'
          });
        }
      } catch (rpcError) {
        console.error('Exception in RPC function:', rpcError);
        // Continue to fallback approach
      }
      
      // Final fallback: Standard query builder approach
      console.log('Falling back to standard query builder');
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('flushing_records')
        .select('*')
        .order('id', { ascending: false })
        .limit(MAX_ENTRIES);
        
      if (fallbackError) {
        throw new Error(`Fallback query error: ${fallbackError.message}`);
      }
      
      entries = fallbackData || [];
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
    
    // Process the entries we've retrieved
    const processedEntries = await processEntries(entries);
    
    // Return the processed entries
    return NextResponse.json({ 
      entries: processedEntries,
      source: 'standard-query'
    });
  } catch (error: any) {
    console.error('Error in direct feed API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch feed', message: error.message },
      { status: 500 }
    );
  }
}