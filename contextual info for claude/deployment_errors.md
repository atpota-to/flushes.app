./src/app/api/bluesky/flushing/route.ts:87:7
Type error: Element implicitly has an 'any' type because expression of type 'string' can't be used to index type '{}'.
  No index signature with a parameter of type 'string' was found on type '{}'.
  85 |     const responseHeaders = {};
  86 |     response.headers.forEach((value, key) => {
> 87 |       responseHeaders[key] = value;
     |       ^
  88 |     });
  89 |     console.log('Response headers:', JSON.stringify(responseHeaders));
  90 |     
Next.js build worker exited with code: 1 and signal: null
Error: Command "npm run build" exited with 1
