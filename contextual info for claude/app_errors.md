Storage access automatically granted for Dynamic State Partitioning “https://bsky.social” on “https://flushing.im”. callback
GET
https://flushing.im/favicon.ico
[HTTP/2 404  38ms]

Exchanging code for token... page-39996d834c0500b1.js:1:1805
No nonce provided, getting one... page-39996d834c0500b1.js:1:9647
Cross-Origin Request Blocked: The Same Origin Policy disallows reading the remote resource at https://bsky.social/oauth/token. (Reason: Did not find method in CORS header ‘Access-Control-Allow-Methods’).
Cross-Origin Request Blocked: The Same Origin Policy disallows reading the remote resource at https://bsky.social/oauth/token. (Reason: CORS request did not succeed). Status code: (null).
Error getting nonce: TypeError: NetworkError when attempting to fetch resource. 117-2ec7e7ac1f9acc59.js:1:4081
Could not obtain a nonce, proceeding without one page-39996d834c0500b1.js:1:9769
Creating DPoP token with nonce: undefined page-39996d834c0500b1.js:1:9834
Making token request with DPoP token page-39996d834c0500b1.js:1:9947
XHRPOST
https://bsky.social/oauth/token
[HTTP/2 400  29ms]

Token exchange error: Error: Token request failed: 400, {"error":"use_dpop_nonce","error_description":"Authorization server requires nonce in DPoP proof"}
    NextJS 32
117-2ec7e7ac1f9acc59.js:1:4081
