check out the screenshot at "contextual info for claude/Screenshot 2025-03-07 at 5.39.21 PM.png" to see what i see in my browser

Storage access automatically granted for Dynamic State Partitioning “https://bsky.social” on “https://flushing.im”. callback
GET
https://flushing.im/favicon.ico
[HTTP/2 404  50ms]

Exchanging code for token... page-85bd1c0d72939d74.js:1:1805
No nonce provided, getting one from API... page-85bd1c0d72939d74.js:1:8812
Obtained nonce from API: S3O0aOAac8lZsXVjI0LeT_Rk36n_6EDlVNRgvHnZkzE page-85bd1c0d72939d74.js:1:8889
Creating DPoP token with nonce: S3O0aOAac8lZsXVjI0LeT_Rk36n_6EDlVNRgvHnZkzE page-85bd1c0d72939d74.js:1:9001
Making token request via proxy API page-85bd1c0d72939d74.js:1:9140
Token request successful page-85bd1c0d72939d74.js:1:9633
Getting profile via proxy API page-85bd1c0d72939d74.js:1:5116
XHRPOST
https://flushing.im/api/bluesky/profile
[HTTP/2 400  81ms]

Profile fetch error: 
Object { error: "InvalidRequest", message: 'Error: Params must have the property "handle"' }
117-5a63be7615398d9c.js:1:4081
Error resolving handle: Error: Profile fetch failed: 400
    NextJS 32
117-5a63be7615398d9c.js:1:4081
Creating flushing status with nonce: null page-85bd1c0d72939d74.js:1:5774
XHRPOST
https://flushing.im/api/bluesky/flushing
[HTTP/2 400  127ms]

Status creation error: 
Object { error: "InvalidToken", message: "OAuth tokens are meant for PDS access only" }
117-5a63be7615398d9c.js:1:4081
Error creating flushing status: Error: Status creation failed: 400
    NextJS 31
117-5a63be7615398d9c.js:1:4081
Failed to update status: Error: Status creation failed: 400
    NextJS 31
117-5a63be7615398d9c.js:1:4081
