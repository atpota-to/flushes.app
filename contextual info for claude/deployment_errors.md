Failed to compile.
./src/app/auth/callback/page.tsx:165:61
Type error: Cannot find name 'pdsEndpoint'.
  163 |         
  164 |         // Log the PDS endpoint that will be used
> 165 |         console.log('Using PDS endpoint for API requests:', pdsEndpoint);
      |                                                             ^
  166 |         
  167 |         // Make sure pdsEndpoint is accessible here for setAuth function
  168 |         const extractedPdsEndpoint = pdsEndpoint;
Next.js build worker exited with code: 1 and signal: null
Error: Command "npm run build" exited with 1