import { NextRequest, NextResponse } from 'next/server';

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
    
    // Make a direct fetch request to the Bluesky API endpoint
    const apiUrl = `https://bsky.social/xrpc/app.bsky.actor.searchActorsTypeahead?q=${encodeURIComponent(term)}&limit=5`;
    
    console.log('Fetching from API:', apiUrl);
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('API response error:', response.status, errorText);
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Format the response for the client
    const suggestions = data.actors.map((actor: any) => ({
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