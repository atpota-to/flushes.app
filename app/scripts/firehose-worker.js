// jetstream-consumer.js
// Script to consume Bluesky firehose via Jetstream and save records to Supabase

import WebSocket from 'ws';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import https from 'https';
import { promisify } from 'util';

// Load environment variables
dotenv.config();

// Configure Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Configure Jetstream connection
const JETSTREAM_URL = 'wss://jetstream2.us-east.bsky.network/subscribe';
const WANTED_COLLECTION = 'im.flushing.right.now';
const CURSOR_FILE_PATH = path.join(process.cwd(), 'cursor.txt');

// Read cursor from file if it exists
function loadCursor() {
  try {
    if (fs.existsSync(CURSOR_FILE_PATH)) {
      const cursor = fs.readFileSync(CURSOR_FILE_PATH, 'utf8').trim();
      console.log(`Loaded cursor: ${cursor}`);
      return cursor;
    }
  } catch (error) {
    console.error('Error loading cursor:', error);
  }
  return null;
}

// Save cursor to file
function saveCursor(cursor) {
  try {
    fs.writeFileSync(CURSOR_FILE_PATH, cursor.toString());
  } catch (error) {
    console.error('Error saving cursor:', error);
  }
}

// Utility function to add response headers to avoid rate limiting
function getRequestOptions(url) {
  const parsedUrl = new URL(url);
  return {
    hostname: parsedUrl.hostname,
    path: parsedUrl.pathname + parsedUrl.search,
    headers: {
      'User-Agent': 'FlushingRecorder/1.0 (https://example.com/)',
      'Accept': 'application/json'
    },
    timeout: 10000
  };
}

// Resolve a DID to a handle using multiple methods
async function resolveDIDToHandle(did) {
  console.log(`Attempting to resolve DID: ${did}`);
  
  // Make sure the DID is properly formatted
  if (!did || !did.startsWith('did:')) {
    console.error(`Invalid DID format: ${did}`);
    return null;
  }
  
  // Method 1: Try the Bluesky API (most reliable)
  try {
    console.log(`Trying Bluesky API method for ${did}`);
    const handle = await resolveDIDWithBskyAPI(did);
    if (handle) {
      console.log(`Bluesky API resolved ${did} to ${handle}`);
      return handle;
    }
  } catch (error) {
    console.error(`Bluesky API method failed for ${did}:`, error);
  }
  
  // Method 2: Try the PLC directory
  try {
    console.log(`Trying PLC directory method for ${did}`);
    const handle = await resolveDIDWithPLC(did);
    if (handle) {
      console.log(`PLC directory resolved ${did} to ${handle}`);
      return handle;
    }
  } catch (error) {
    console.error(`PLC directory method failed for ${did}:`, error);
  }
  
  // Method 3: Try handle resolver (unlikely to work for DIDs, but worth a try)
  try {
    console.log(`Trying handle resolver method for ${did}`);
    const handle = await resolveDIDWithHandleResolver(did);
    if (handle) {
      console.log(`Handle resolver resolved ${did} to ${handle}`);
      return handle;
    }
  } catch (error) {
    console.error(`Handle resolver method failed for ${did}:`, error);
  }
  
  console.log(`All resolution methods failed for ${did}`);
  return null;
}

// Method 1: Resolve using PLC directory
async function resolveDIDWithPLC(did) {
  return new Promise((resolve, reject) => {
    const url = `https://plc.directory/${encodeURIComponent(did)}`;
    console.log(`Making PLC directory request to: ${url}`);
    
    const options = getRequestOptions(url);
    
    const req = https.get(options, (res) => {
      let data = '';
      
      // Log response status
      console.log(`PLC Directory response status: ${res.statusCode}`);
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          console.log(`PLC raw response for ${did}: ${data.substring(0, 300)}...`);
          
          if (res.statusCode !== 200) {
            console.warn(`Failed to resolve DID ${did} with PLC: HTTP ${res.statusCode}`);
            resolve(null);
            return;
          }
          
          // Try to parse as JSON first
          try {
            const didDoc = JSON.parse(data);
            
            // Extract handle from alsoKnownAs
            if (didDoc.alsoKnownAs && Array.isArray(didDoc.alsoKnownAs) && didDoc.alsoKnownAs.length > 0) {
              console.log(`Found alsoKnownAs entries: ${JSON.stringify(didDoc.alsoKnownAs)}`);
              
              // Look for value starting with "at://"
              const atValue = didDoc.alsoKnownAs.find(value => value.startsWith('at://'));
              if (atValue) {
                const handle = atValue.replace('at://', '');
                console.log(`Successfully resolved ${did} to handle: ${handle}`);
                resolve(handle);
                return;
              } else {
                console.warn(`No 'at://' prefix found in alsoKnownAs for ${did}`);
              }
            } else {
              console.warn(`No alsoKnownAs property found in DID document for ${did}`);
            }
          } catch (jsonError) {
            console.log(`JSON parsing failed, trying regex: ${jsonError.message}`);
          }
          
          // If JSON parsing fails or doesn't find handle, try regex as fallback
          const atMatch = data.match(/at:\/\/([^"'\\s]+)/);
          if (atMatch && atMatch[1]) {
            const handle = atMatch[1];
            console.log(`Regex extracted handle for ${did}: ${handle}`);
            resolve(handle);
            return;
          }
          
          resolve(null); // No handle found
        } catch (error) {
          console.error(`Error parsing PLC directory response for ${did}:`, error);
          resolve(null);
        }
      });
    });
    
    req.on('error', (error) => {
      console.error(`Error fetching PLC document for ${did}:`, error);
      resolve(null);
    });
    
    req.on('timeout', () => {
      console.error(`PLC request timeout for ${did}`);
      req.destroy();
      resolve(null);
    });
  });
}

// Method 2: Resolve using Bluesky API
async function resolveDIDWithBskyAPI(did) {
  return new Promise((resolve, reject) => {
    // The Bluesky API endpoint for DID-to-handle resolution
    const url = `https://api.bsky.app/xrpc/com.atproto.repo.describeRepo?repo=${encodeURIComponent(did)}`;
    console.log(`Making Bluesky API request to: ${url}`);
    
    const options = getRequestOptions(url);
    
    const req = https.get(options, (res) => {
      let data = '';
      
      // Log response status
      console.log(`Bluesky API response status: ${res.statusCode}`);
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          if (res.statusCode !== 200) {
            console.warn(`Failed to resolve DID ${did} with Bluesky API: HTTP ${res.statusCode}`);
            resolve(null);
            return;
          }
          
          const repoInfo = JSON.parse(data);
          
          if (repoInfo && repoInfo.handle) {
            const handle = repoInfo.handle;
            console.log(`Successfully resolved ${did} to handle: ${handle} using Bluesky API`);
            resolve(handle);
            return;
          }
          
          resolve(null); // No handle found
        } catch (error) {
          console.error(`Error parsing Bluesky API response for ${did}:`, error);
          resolve(null);
        }
      });
    });
    
    req.on('error', (error) => {
      console.error(`Error fetching from Bluesky API for ${did}:`, error);
      resolve(null);
    });
    
    req.on('timeout', () => {
      console.error(`Bluesky API request timeout for ${did}`);
      req.destroy();
      resolve(null);
    });
  });
}

// Method 3: Try Bluesky official handle resolver
async function resolveDIDWithHandleResolver(did) {
  try {
    // First check if this is already a handle format (user.bsky.social)
    if (did.includes('.') && !did.startsWith('did:')) {
      console.log(`Input appears to be a handle already: ${did}`);
      return did;
    }
    
    return new Promise((resolve, reject) => {
      const url = `https://api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(did)}`;
      console.log(`Making handle resolver request to: ${url}`);
      
      const options = getRequestOptions(url);
      
      const req = https.get(options, (res) => {
        let data = '';
        
        // Log response status
        console.log(`Handle resolver response status: ${res.statusCode}`);
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            if (res.statusCode !== 200) {
              console.warn(`Failed to resolve ${did} with handle resolver: HTTP ${res.statusCode}`);
              resolve(null);
              return;
            }
            
            const response = JSON.parse(data);
            
            if (response && response.did === did) {
              // This means we resolved a handle to a DID, but we want the opposite
              resolve(null);
              return;
            }
            
            resolve(null); // No handle found
          } catch (error) {
            console.error(`Error parsing handle resolver response for ${did}:`, error);
            resolve(null);
          }
        });
      });
      
      req.on('error', (error) => {
        console.error(`Error fetching from handle resolver for ${did}:`, error);
        resolve(null);
      });
      
      req.on('timeout', () => {
        console.error(`Handle resolver request timeout for ${did}`);
        req.destroy();
        resolve(null);
      });
    });
  } catch (error) {
    console.error(`Exception in handle resolver for ${did}:`, error);
    return null;
  }
}

// Process Jetstream event
async function processEvent(event) {
  try {
    // Save the cursor for each event we process
    saveCursor(event.time_us);
    
    // Only process commit events
    if (event.kind !== 'commit') {
      // Don't log skipped events to reduce noise
      return;
    }
    
    // Only process commits for our target collection
    if (event.commit.collection !== WANTED_COLLECTION) {
      // Don't log skipped collections to reduce noise
      return;
    }
    
    // Now we can log since we know it's relevant
    console.log(`Processing event: ${JSON.stringify(event).substring(0, 500)}...`);
    
    // Extract record data
    const { did, time_us } = event;
    const { operation, collection, rkey, record, cid } = event.commit;
    
    console.log(`Processing ${operation} operation for DID: ${did}, collection: ${collection}, rkey: ${rkey}`);
    
    // Skip delete operations
    if (operation === 'delete') {
      console.log(`Skipping delete operation`);
      return;
    }
    
    // Try different approaches to get a handle
    
    // Approach 1: Check if handle is already in the record
    let handle = null;
    if (record && record.handle) {
      console.log(`Found handle in record: ${record.handle}`);
      handle = record.handle;
    }
    
    // Approach 2: Try to resolve via APIs
    if (!handle) {
      console.log(`Resolving handle for DID: ${did}`);
      handle = await resolveDIDToHandle(did);
      
      if (handle) {
        console.log(`Successfully resolved handle: ${handle}`);
      } else {
        console.log(`Failed to resolve handle for DID: ${did}`);
        
        // Check existing records in database for this DID
        try {
          const { data, error } = await supabase
            .from('flushing_records')
            .select('handle')
            .eq('did', did)
            .not('handle', 'is', null)
            .not('handle', 'eq', 'unknown')
            .order('indexed_at', { ascending: false })
            .limit(1);
            
          if (!error && data && data.length > 0 && data[0].handle) {
            handle = data[0].handle;
            console.log(`Found handle in database for DID ${did}: ${handle}`);
          } else {
            console.log(`No existing handle found in database for DID: ${did}`);
            handle = 'unknown'; // Set explicitly to unknown
          }
        } catch (dbError) {
          console.error(`Error checking database for existing handle: ${dbError.message}`);
          handle = 'unknown'; // Set explicitly if DB query fails
        }
      }
    }
    
    // Double-check that we have a handle, default to 'unknown' if not
    if (!handle) {
      console.log(`No handle could be resolved for DID ${did}, using 'unknown'`);
      handle = 'unknown';
    }
    
    // Prepare data for insertion - DO NOT include id field at all
    const recordData = {
      did,
      collection,
      type: record?.$type,
      created_at: record?.createdAt || new Date().toISOString(),
      emoji: record?.emoji,
      text: record?.text,
      cid,
      uri: `at://${did}/${collection}/${rkey}`,
      indexed_at: new Date().toISOString(),
      handle: handle // This will never be null or undefined now
    };
    
    console.log(`Preparing to insert/update record with handle '${recordData.handle}'`);
    
    // First check if the record already exists
    const { data: existingData, error: checkError } = await supabase
      .from('flushing_records')
      .select('id, handle')
      .eq('uri', recordData.uri)
      .limit(1);
    
    let result;
    
    if (checkError) {
      console.error(`Error checking if record exists: ${checkError.message}`);
      return;
    }
    
    // If record exists, update it
    if (existingData && existingData.length > 0) {
      console.log(`Record with URI ${recordData.uri} already exists, updating`);
      
      // If existing record has a valid handle and current handle is 'unknown', use the existing handle
      if (existingData[0].handle && existingData[0].handle !== 'unknown' && recordData.handle === 'unknown') {
        console.log(`Keeping existing handle '${existingData[0].handle}' instead of replacing with 'unknown'`);
        recordData.handle = existingData[0].handle;
      }
      
      const { data, error } = await supabase
        .from('flushing_records')
        .update(recordData)
        .eq('uri', recordData.uri);
      
      result = { data, error };
    } 
    // Otherwise insert a new record
    else {
      console.log(`Record with URI ${recordData.uri} doesn't exist, inserting with handle: ${recordData.handle}`);
      const { data, error } = await supabase
        .from('flushing_records')
        .insert(recordData);
      
      result = { data, error };
    }
    
    // Check the result of the operation
    if (result.error) {
      console.error(`Error saving record to Supabase: ${result.error.message}`);
      console.error(`Failed record data: ${JSON.stringify(recordData)}`);
    } else {
      console.log(`Successfully saved record: ${recordData.uri} (handle: ${recordData.handle})`);
    }
    
  } catch (error) {
    console.error(`Error processing event: ${error.message}`);
    console.error(error.stack);
  }
}

// Process 'identity' events when they come through the firehose
async function processIdentityEvent(event) {
  try {
    if (event.kind !== 'identity' || !event.identity) {
      return;
    }
    
    const { did, handle } = event.identity;
    
    if (did && handle) {
      // Check if we have any records with this DID that have 'unknown' handles
      try {
        const { data, error } = await supabase
          .from('flushing_records')
          .select('uri')
          .eq('did', did)
          .eq('handle', 'unknown');
        
        if (!error && data && data.length > 0) {
          console.log(`Found ${data.length} records with DID ${did} and unknown handle. Updating to ${handle}...`);
          
          // Update all matching records with the new handle
          const { updateData, updateError } = await supabase
            .from('flushing_records')
            .update({ handle })
            .eq('did', did)
            .eq('handle', 'unknown');
          
          if (updateError) {
            console.error(`Error updating records with DID ${did}: ${updateError.message}`);
          } else {
            console.log(`Successfully updated handle for records with DID ${did} to ${handle}`);
          }
        }
      } catch (dbError) {
        console.error(`Error updating unknown handles: ${dbError.message}`);
      }
    }
  } catch (error) {
    console.error(`Error processing identity event: ${error.message}`);
  }
}

// Connect to Jetstream and process events
function connectToJetstream() {
  const cursor = loadCursor();
  
  // Building the URL with query parameters - now include identity events!
  // Including identity events will help us maintain DID-to-handle mapping
  let url = `${JETSTREAM_URL}?wantedCollections=${WANTED_COLLECTION}`;
  if (cursor) {
    // Subtract a few seconds (in microseconds) to ensure no gaps
    const rewindCursor = parseInt(cursor) - 5000000; // 5 seconds in microseconds
    url += `&cursor=${rewindCursor}`;
  }
  
  console.log(`Connecting to Jetstream: ${url}`);
  
  const ws = new WebSocket(url);
  
  ws.on('open', () => {
    console.log('Connected to Jetstream');
  });
  
  ws.on('message', async (data) => {
    try {
      const event = JSON.parse(data.toString());
      
      // Process identity events to keep our DID-to-handle mapping up to date
      if (event.kind === 'identity') {
        await processIdentityEvent(event);
      }
      
      // Process other events normally
      await processEvent(event);
    } catch (error) {
      console.error('Error parsing message:', error);
      // Don't log message data to reduce noise
    }
  });
  
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    setTimeout(connectToJetstream, 5000); // Reconnect after 5 seconds
  });
  
  ws.on('close', () => {
    console.log('Connection closed. Attempting to reconnect...');
    setTimeout(connectToJetstream, 5000); // Reconnect after 5 seconds
  });
  
  // Heartbeat to keep the connection alive
  const interval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.ping();
    } else {
      clearInterval(interval);
    }
  }, 30000);
}

// Start the application
function start() {
  console.log('Starting Jetstream consumer...');
  connectToJetstream();
  
  // Handle process termination
  process.on('SIGINT', () => {
    console.log('Process terminated. Exiting...');
    process.exit(0);
  });
}

start();