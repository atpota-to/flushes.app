import { OAuthSession } from '@atproto/oauth-client-browser';
import { Agent } from '@atproto/api';

// API client for OAuth session using @atproto/api Agent

// Create a post using the OAuth session with @atproto/api Agent
export async function createPost(session: OAuthSession, options: {
  text: string;
  reply?: {
    root: { uri: string; cid: string };
    parent: { uri: string; cid: string };
  };
  embed?: any;
  langs?: string[];
  createdAt?: string;
}) {
  // Ensure we're on the client side
  if (typeof window === 'undefined') {
    throw new Error('API client can only be used on the client side');
  }

  try {
    console.log('Creating post with session:', session.sub);
    console.log('Post text:', options.text);
    
    // Create an Agent instance using the OAuth session
    const agent = new Agent(session);
    
    // Extract emoji from text if present, default to toilet
    let emoji = '🚽';
    let cleanText = options.text;
    
    // Simple emoji extraction - look for common toilet/bathroom emojis
    const toiletEmojis = ['🚽', '🧻', '💩', '💨', '🚾', '🧼', '🪠', '🚻', '🩸', '💧', '💦', '😌', 
      '😣', '🤢', '🤮', '🥴', '😮‍💨', '😳', '😵', '🌾', '🍦', '📱', '📖', '💭',
      '1️⃣', '2️⃣', '🟡', '🟤'];
    
    // Sort emojis by length (longest first) to handle compound emojis correctly
    const sortedEmojis = [...toiletEmojis].sort((a, b) => b.length - a.length);
    
    // Look for any of these emojis in the text
    for (const testEmoji of sortedEmojis) {
      if (options.text.includes(testEmoji)) {
        emoji = testEmoji;
        cleanText = options.text.replace(testEmoji, '').trim();
        break;
      }
    }
    
    // Create a record directly using the Agent, following the cred.blue pattern
    const flushRecord = {
      $type: 'im.flushing.right.now',
      text: cleanText,
      emoji: emoji,
      createdAt: new Date().toISOString(),
    };
    
    console.log('Creating flush record:', flushRecord);
    
    // Use the agent to create the record directly in the user's PDS
    const result = await agent.api.com.atproto.repo.createRecord({
      repo: session.sub, // Use the user's DID
      collection: 'im.flushing.right.now',
      record: flushRecord,
    });
    
    console.log('Post created successfully:', result);
    return result;
  } catch (error) {
    console.error('Failed to create post:', error);
    throw error;
  }
}

// Delete a flush record
export async function deleteFlushRecord(session: OAuthSession, recordUri: string) {
  if (typeof window === 'undefined') {
    throw new Error('API client can only be used on the client side');
  }

  try {
    console.log('Deleting flush record:', recordUri);
    
    // Create an Agent instance using the OAuth session
    const agent = new Agent(session);
    
    // Parse the AT URI to extract repo, collection, and rkey
    // Format: at://did:plc:xxx/collection.name/rkey
    const uriParts = recordUri.replace('at://', '').split('/');
    if (uriParts.length !== 3) {
      throw new Error('Invalid record URI format');
    }
    
    const [repo, collection, rkey] = uriParts;
    
    console.log('Deleting record:', { repo, collection, rkey });
    
    // Delete the record
    const result = await agent.api.com.atproto.repo.deleteRecord({
      repo,
      collection,
      rkey
    });
    
    console.log('Record deleted successfully');
    return result;
  } catch (error) {
    console.error('Failed to delete record:', error);
    throw error;
  }
}

// Update a flush record using putRecord
export async function updateFlushRecord(
  session: OAuthSession, 
  recordUri: string,
  text: string,
  emoji: string,
  originalCreatedAt?: string
) {
  if (typeof window === 'undefined') {
    throw new Error('API client can only be used on the client side');
  }

  try {
    console.log('Updating flush record:', recordUri);
    
    // Create an Agent instance using the OAuth session
    const agent = new Agent(session);
    
    // Parse the AT URI
    const uriParts = recordUri.replace('at://', '').split('/');
    if (uriParts.length !== 3) {
      throw new Error('Invalid record URI format');
    }
    
    const [repo, collection, rkey] = uriParts;
    
    console.log('Updating record:', { repo, collection, rkey });
    
    // Create the updated record
    const updatedRecord = {
      $type: 'im.flushing.right.now',
      text,
      emoji,
      createdAt: originalCreatedAt || new Date().toISOString(),
    };
    
    console.log('Updated record data:', updatedRecord);
    
    // Update the record using putRecord
    const result = await agent.api.com.atproto.repo.putRecord({
      repo,
      collection,
      rkey,
      record: updatedRecord
    });
    
    console.log('Record updated successfully');
    return result;
  } catch (error) {
    console.error('Failed to update record:', error);
    throw error;
  }
} 