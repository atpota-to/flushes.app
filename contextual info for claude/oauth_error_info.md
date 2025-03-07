Here are my answers to your questions

  To fix this, I need to understand:

  1. Does the app successfully redirect to Bluesky for authentication? YES
  2. Does it get redirected back to our callback URL with a code? Maybe? Here is some of the stuff I see in my network tab:

https://bsky.social/oauth/authorize/accept?request_uri=urn%3Aietf%3Aparams%3Aoauth%3Arequest_uri%3Areq-70bdef2a0a77d1954a96bf4256cd92b7&account_sub=did%3Aplc%3Agq4fo3u6tqzzdkjlwzpb23tj&client_id=https%3A%2F%2Fflushing.im%2Fclient-metadata.json&csrf_token=a6df20ff01f1e532

https://flushing.im/auth/callback?iss=https%3A%2F%2Fbsky.social&state=I3G-YFVmGt72qpIEZpEZ9wi_v4LVCrGL&code=cod-db4470c0776842c73a284a597c8b3c4529990aa0f8d2fe1a36fac9d74bf42bdc

400 POST https://bsky.social/oauth/token

  3. Is the error happening when trying to exchange the code for tokens? Potentially

  The issue appears to be in the getAccessToken function in our
  bluesky-auth.ts file. When making the token request, we need to properly
  implement the DPoP nonce exchange flow:

  1. First make a request without a nonce
  2. Get the nonce from the 401 response
  3. Retry with the nonce included in the DPoP header

  Let me modify the getAccessToken function to better handle the DPoP nonce
  flow.
