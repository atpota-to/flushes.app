const WebSocket = require('ws');
const cbor = require('cbor-web');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Constants
const FIREHOSE_URL = 'wss://bsky.network/xrpc/com.atproto.sync.subscribeRepos';
const FLUSHING_STATUS_NSID = 'im.flushing.right.now';

// Supabase setup - ensure you have these set in your .env file
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Reconnection parameters
const MAX_RECONNECT_DELAY = 30000; // 30 seconds
let reconnectAttempts = 0;
let ws = null;

// Connect to the firehose
function connectToFirehose() {
  console.log('Connecting to Bluesky firehose...');
  
  ws = new WebSocket(FIREHOSE_URL);
  
  ws.on('open', () => {
    console.log('Connected to firehose.');
    // Reset reconnect counter on successful connection
    reconnectAttempts = 0;
  });
  
  ws.on('message', async (data) => {
    try {
      // In a real implementation, parse CBOR data to extract repo operations
      // For now, log the message to track activity
      console.log('Received message from firehose');
      
      // Decode the CBOR message (this is a simplified version)
      // The actual implementation would need to handle the header and payload separately
      const decoded = cbor.decode(data);
      
      // Process the message if it's a commit
      if (decoded.op === 1 && decoded.t === '#commit') {
        // Process repo commit
        const commit = decoded.payload;
        
        // Check if this commit contains a flushing record
        const flushingOps = commit.ops.filter(op => {
          return op.path.startsWith(FLUSHING_STATUS_NSID) && op.action === 'create';
        });
        
        if (flushingOps.length > 0) {
          console.log(`Found ${flushingOps.length} flushing records in commit from ${commit.repo}`);
          
          // Process each flushing record
          for (const op of flushingOps) {
            await processFlushingRecord(commit.repo, op.path, op.cid, commit.blocks);
          }
        }
      }
    } catch (error) {
      console.error('Error processing message:', error);
    }
  });
  
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
  
  ws.on('close', (code, reason) => {
    console.log(`Connection closed: ${code} - ${reason}`);
    
    // Implement exponential backoff for reconnection
    reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), MAX_RECONNECT_DELAY);
    
    console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttempts})...`);
    setTimeout(connectToFirehose, delay);
  });
}

// Process a flushing record and store it in Supabase
async function processFlushingRecord(authorDid, recordPath, cid, blocks) {
  try {
    // Extract the record data from the blocks (simplified)
    // In a real implementation, you would need to properly decode the IPLD blocks
    const recordData = blocks[cid];
    
    if (!recordData) {
      console.error('Record data not found in blocks');
      return;
    }
    
    // Extract the record URI
    const uri = `at://${authorDid}/${recordPath}`;
    
    // Check if we already have this record
    const { data: existingRecord } = await supabase
      .from('flushing_entries')
      .select('id')
      .eq('uri', uri)
      .single();
    
    if (existingRecord) {
      console.log('Record already exists, skipping');
      return;
    }
    
    // Create a new entry in Supabase
    const newEntry = {
      uri,
      cid,
      author_did: authorDid,
      text: recordData.text,
      emoji: recordData.emoji,
      created_at: recordData.createdAt
    };
    
    const { error } = await supabase
      .from('flushing_entries')
      .insert(newEntry);
    
    if (error) {
      console.error('Error inserting record:', error);
    } else {
      console.log('Successfully stored new flushing record');
    }
    
    // Also try to resolve the author's handle if we don't have it
    const { data: authorData } = await supabase
      .from('users')
      .select('handle')
      .eq('did', authorDid)
      .single();
    
    if (!authorData || !authorData.handle) {
      // TODO: Use the Bluesky API to resolve the handle from the DID
      // This would be done with the BskyAgent or direct API call
      console.log('Need to resolve handle for DID:', authorDid);
    }
  } catch (error) {
    console.error('Error processing flushing record:', error);
  }
}

// Create the necessary tables if they don't exist
async function setupDatabase() {
  try {
    // Create flushing_entries table
    const { error: entriesError } = await supabase.rpc('create_flushing_entries_table_if_not_exists');
    if (entriesError) {
      console.error('Error creating flushing_entries table:', entriesError);
    }
    
    // Create users table
    const { error: usersError } = await supabase.rpc('create_users_table_if_not_exists');
    if (usersError) {
      console.error('Error creating users table:', usersError);
    }
  } catch (error) {
    console.error('Error setting up database:', error);
  }
}

// Start the worker
async function start() {
  console.log('Starting firehose worker...');
  
  // Check if we have the required environment variables
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
    process.exit(1);
  }
  
  // Setup the database
  await setupDatabase();
  
  // Connect to the firehose
  connectToFirehose();
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('Shutting down...');
  if (ws) {
    ws.close();
  }
  process.exit(0);
});

// Start the worker
start();