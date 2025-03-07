Failed to compile.
./src/app/api/bluesky/flushing/route.ts:82:33
Type error: Property 'error' does not exist on type '{}'.
  80 |     if (!response.ok) {
  81 |         return NextResponse.json({
> 82 |             error: responseData.error || 'Status creation failed',
     |                                 ^
  83 |             message: responseData.message || responseText,
  84 |             status: response.status,
  85 |             details: responseData
Next.js build worker exited with code: 1 and signal: null
Error: Command "npm run build" exited with 1