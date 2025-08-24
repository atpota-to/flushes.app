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