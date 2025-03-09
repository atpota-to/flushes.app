import { NextRequest, NextResponse } from 'next/server';
import { BskyAgent } from '@atproto/api';

// Configure this route as dynamic to fix static generation issues
export const dynamic = 'force-dynamic';

// This endpoint provides user search suggestions using Bluesky's searchActorsTypeahead API
export async function GET(request: NextRequest) {
  try {
    // Get the query parameter from the URL
    const url = new URL(request.url);
    const term = url.searchParams.get('q');
    
    if (!term) {
      return NextResponse.json({ suggestions: [] }, { status: 200 });
    }
    
    // Create a Bluesky agent instance
    const agent = new BskyAgent({
      service: 'https://bsky.social'
    });
    
    // The Bluesky API requires login even for public APIs,
    // but we can use a fake login with empty credentials for this purpose
    await agent.login({ identifier: '', password: '' });
    
    // Make a request to the typeahead API
    const response = await agent.app.bsky.actor.searchActorsTypeahead({
      term,
      limit: 5
    });
    
    if (!response.success) {
      throw new Error('Failed to fetch user suggestions');
    }
    
    // Format the response for the client
    const suggestions = response.data.actors.map(actor => ({
      did: actor.did,
      handle: actor.handle,
      displayName: actor.displayName,
      avatar: actor.avatar || null
    }));
    
    return NextResponse.json({ suggestions }, { status: 200 });
  } catch (error: any) {
    console.error('User search error:', error);
    return NextResponse.json(
      { error: 'Search failed', message: error.message },
      { status: 500 }
    );
  }
}