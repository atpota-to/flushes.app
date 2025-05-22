import { OAuthSession } from '@atproto/oauth-client-browser';

// Simplified API client for OAuth session
// TODO: Implement proper API integration after authentication is working

// Create a post using the OAuth session as a fetch handler
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
    
    // Extract emoji from text if present, default to toilet
    let emoji = '🚽';
    let cleanText = options.text;
    
    // Simple emoji extraction - look for common toilet/bathroom emojis
    const toiletEmojis = ['🚽', '🧻', '💩', '💨', '🚾', '🧼', '🪠', '🚻', '🩸', '💧', '💦', '😌', 
      '😣', '🤢', '🤮', '🥴', '😮‍💨', '😳', '😵', '🌾', '🍦', '📱', '📖', '💭',
      '1️⃣', '2️⃣', '🟡', '🟤'];
    
    // Look for any of these emojis in the text
    for (const testEmoji of toiletEmojis) {
      if (options.text.includes(testEmoji)) {
        emoji = testEmoji;
        cleanText = options.text.replace(testEmoji, '').trim();
        break;
      }
    }
    
    // Use regular fetch to call our own API endpoint
    // TODO: Later we can modify this to call the user's PDS directly using session.fetchHandler
    const response = await fetch('/api/bluesky/flushing', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: cleanText,
        emoji,
        did: session.sub,
        // For now, we'll just pass the session info and let the API endpoint
        // figure out how to use the OAuth session
        sessionSub: session.sub
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('API response error:', errorData);
      throw new Error(`Failed to create post: ${response.status}`);
    }

    const result = await response.json();
    console.log('Post created successfully:', result);
    return result;
  } catch (error) {
    console.error('Failed to create post:', error);
    throw error;
  }
} 