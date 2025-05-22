# OAuth Migration Guide: Custom Implementation → @atproto/oauth-client-browser

This guide explains how to migrate from your current custom OAuth implementation to the official `@atproto/oauth-client-browser` package, which provides better reliability, maintenance, and features.

## Overview of Changes

### What's Being Replaced

**Current Implementation:**
- Custom PKCE flow with manual code generation (`bluesky-auth.ts`)
- Manual DPoP token generation and nonce handling
- Complex token refresh logic with multiple retry strategies
- Custom API proxy routes (`/api/auth/token`, `/api/auth/nonce`)
- Manual storage management across localStorage/sessionStorage
- Complex auth context with manual state management

**New Implementation:**
- Official `@atproto/oauth-client-browser` with automatic session management
- Automatic token refresh and DPoP handling
- Built-in IndexedDB storage
- Direct integration with `@atproto/api`
- Simplified auth context
- No need for custom API routes

## Migration Steps

### 1. Update App Layout to Use New Auth Context

Replace the old auth context with the new one in your main layout:

```tsx
// Before: app/src/app/layout.tsx
import { AuthProvider } from '@/lib/auth-context'

// After:
import { AuthProvider } from '@/lib/auth-context-new'
```

### 2. Replace Login Page

```tsx
// Replace: app/src/app/auth/login/page.tsx
// With: app/src/app/auth/login/page-new.tsx

// Then rename page-new.tsx to page.tsx
```

### 3. Replace Callback Page

```tsx
// Replace: app/src/app/auth/callback/page.tsx  
// With: app/src/app/auth/callback/page-new.tsx

// Then rename page-new.tsx to page.tsx
```

### 4. Update API Calls

Replace your existing API calls with the new simplified client:

```tsx
// Before:
import { getProfile, makeAuthenticatedRequest } from '@/lib/bluesky-api'
import { useAuth } from '@/lib/auth-context'

const { accessToken, keyPair, dpopNonce, pdsEndpoint } = useAuth()
const profile = await getProfile(accessToken, keyPair, dpopNonce, handle, pdsEndpoint)

// After:
import { getProfile } from '@/lib/api-client'
import { useAuth } from '@/lib/auth-context-new'

const { session } = useAuth()
if (session) {
  const profile = await getProfile(session)
}
```

### 5. Update Components Using Auth

Update any components that use the auth context:

```tsx
// Before:
const { isAuthenticated, accessToken, did, handle } = useAuth()

// After:
const { isAuthenticated, session } = useAuth()
const did = session?.sub
const handle = session?.info?.handle
// Note: accessToken is available as session?.accessToken if needed for legacy code
```

### 6. Remove Old Files

After migration is complete and tested, you can remove these files:

- `app/src/lib/bluesky-auth.ts` - Custom OAuth implementation
- `app/src/lib/auth-context.tsx` - Old auth context (rename from auth-context-new.tsx)
- `app/src/lib/storage-util.ts` - Custom storage utilities
- `app/src/app/api/auth/token/route.ts` - Custom token exchange API
- `app/src/app/api/auth/nonce/route.ts` - Custom nonce retrieval API
- Old login and callback pages after replacement

### 7. Update Existing API Usage

Replace complex API calls with simplified versions:

```tsx
// Before: Making a post
import { createPost } from '@/lib/bluesky-api'
await createPost(accessToken, keyPair, dpopNonce, postData, pdsEndpoint)

// After:
import { createPost } from '@/lib/api-client'
await createPost(session, { text: "Hello world!" })
```

## Benefits of Migration

### 1. **Simplified Codebase**
- ~1000 lines of custom OAuth code removed
- No more manual DPoP token generation
- No more complex nonce handling
- No more custom API routes

### 2. **Better Reliability** 
- Official implementation tested across many apps
- Automatic retry logic for failed requests
- Better error handling and recovery
- Proper session lifecycle management

### 3. **Improved Security**
- Uses secure IndexedDB storage instead of localStorage
- Proper token refresh with automatic retries
- Better handling of session invalidation
- DPoP implementation follows latest specs

### 4. **Enhanced Features**
- Automatic handle resolution
- Built-in support for third-party PDS servers
- Session restoration across browser sessions
- Event listeners for session changes

### 5. **Better Maintenance**
- Official package maintained by AT Protocol team
- Regular updates and security patches
- Better TypeScript support
- Comprehensive documentation

## Compatibility Notes

### Third-Party PDS Support
The new implementation maintains full support for third-party PDS servers like `geese.blue`. The OAuth client automatically:
- Resolves handle to find the correct PDS
- Uses the appropriate OAuth endpoints
- Manages cross-PDS authentication flows

### Legacy Code Support
The new auth context provides backward compatibility properties:
- `accessToken` - Available as `session?.accessToken`
- `refreshToken` - Available as `session?.refreshToken` 
- `did` - Available as `session?.sub`
- `handle` - Available as `session?.info?.handle`
- `pdsEndpoint` - Extracted from session info

## Testing the Migration

### 1. Test Basic Authentication
- Sign in with a Bluesky handle (e.g., `alice.bsky.social`)
- Verify the callback completes successfully
- Check that session is restored on page refresh

### 2. Test Third-Party PDS
- Sign in with a third-party PDS handle (e.g., `alice.geese.blue`)
- Verify it resolves to the correct PDS
- Test that API calls work correctly

### 3. Test Session Management
- Sign in and close the browser
- Reopen and verify session is restored
- Test sign out functionality

### 4. Test API Calls
- Verify profile loading works
- Test creating posts
- Test liking/unliking posts
- Test following/unfollowing users

## Rollback Plan

If issues arise, you can quickly rollback:

1. Revert the auth context import in `layout.tsx`
2. Restore the original login/callback pages
3. Keep the old implementation files until migration is stable

The old API routes and implementation can remain in place during testing for safety.

## Support

If you encounter issues during migration:
1. Check browser console for OAuth client errors
2. Verify the client metadata URL is accessible
3. Test with different handle types (Bluesky vs third-party)
4. Check that the redirect URI matches exactly

The new implementation should handle most edge cases that the custom implementation addressed, but with much less complexity. 