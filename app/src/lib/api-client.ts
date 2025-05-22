import { OAuthSession } from '@atproto/oauth-client-browser';

// Simplified API client for OAuth session
// TODO: Implement proper API integration after authentication is working

// Create a post - simplified implementation
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
    // For now, we'll make a direct API call to our existing endpoint
    // Later this can be improved to use the OAuth session directly
    console.log('Creating post with session:', session.sub);
    console.log('Post text:', options.text);
    
    const response = await fetch('/api/bluesky/flushing', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: options.text,
        emoji: '🚽', // Default emoji for now
        did: session.sub
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to create post: ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Failed to create post:', error);
    throw error;
  }
} 