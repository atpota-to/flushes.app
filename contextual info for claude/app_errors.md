Storage access automatically granted for Dynamic State Partitioning “https://bsky.social” on “https://flushing.im”. callback
GET
https://flushing.im/favicon.ico
[HTTP/2 404  61ms]

Callback received state: 9StyI... page-099e80a200860a21.js:1:1095
Stored state: 9StyI... page-099e80a200860a21.js:1:1175
Exchanging code for token... page-099e80a200860a21.js:1:2016
No nonce provided, getting one from API... 481-d3c58c35fd99af50.js:1:8385
Obtained nonce from API: nnKOYi3GWF5VHcaGl3ZfUAQeplTiEeWEi6_FH2BGrLI 481-d3c58c35fd99af50.js:1:8462
Creating DPoP token with nonce: nnKOYi3GWF5VHcaGl3ZfUAQeplTiEeWEi6_FH2BGrLI 481-d3c58c35fd99af50.js:1:8574
Making token request via proxy API 481-d3c58c35fd99af50.js:1:8713
Token request successful 481-d3c58c35fd99af50.js:1:9206
Token audience: undefined page-099e80a200860a21.js:1:2368
Token audience missing or not a string: undefined page-099e80a200860a21.js:1:2626
Getting profile via proxy API 481-d3c58c35fd99af50.js:1:3560
Token response: 
Object { access_token: "eyJ0eXAiOiJhdCtqd3QiLCJhbGciOiJFUzI1NksifQ.eyJhdWQiOiJkaWQ6d2ViOmVub2tpLnVzLWVhc3QuaG9zdC5ic2t5Lm5ldHdvcmsiLCJpYXQiOjE3NDEzOTAzMzcsImV4cCI6MTc0MTM5MzkzNywic3ViIjoiZGlkOnBsYzpncTRmbzN1NnRxenpka2psd3pwYjIzdGoiLCJqdGkiOiJ0b2stODAwZjEwZTEzOTEyYjA0MTljOGYyZTc4ZDkzZWRkZjIiLCJjbmYiOnsiamt0IjoiR3lXWnA3cUZOajFiaWttMHhRX1pMTGR4WnhMVTdCNmRqaEZSTU1HR1o0TSJ9LCJjbGllbnRfaWQiOiJodHRwczovL2ZsdXNoaW5nLmltL2NsaWVudC1tZXRhZGF0YS5qc29uIiwic2NvcGUiOiJhdHByb3RvIHRyYW5zaXRpb246Z2VuZXJpYyIsImlzcyI6Imh0dHBzOi8vYnNreS5zb2NpYWwifQ.fIVsf2SJRsaPDCRpaJhYyFsXOpGcvxxutZhqHfLwS97XtMxh63yPZZq26vhC2aHJ_7omR1a6MJjEptDZfvTrVQ", token_type: "DPoP", refresh_token: "ref-2dda4b2d21fbb21df5b02d34f3dafd35ccef542b4a4fce652b3ce1958c7571cd", scope: "atproto transition:generic", expires_in: 3599, sub: "did:plc:gq4fo3u6tqzzdkjlwzpb23tj" }
page-099e80a200860a21.js:1:2883
User DID from token: did:plc:gq4fo3u6tqzzdkjlwzpb23tj page-099e80a200860a21.js:1:2928
Decoded token payload: 
Object { aud: "did:web:enoki.us-east.host.bsky.network", iat: 1741390337, exp: 1741393937, sub: "did:plc:gq4fo3u6tqzzdkjlwzpb23tj", jti: "tok-800f10e13912b0419c8f2e78d93eddf2", cnf: {…}, client_id: "https://flushing.im/client-metadata.json", scope: "atproto transition:generic", iss: "https://bsky.social" }
page-099e80a200860a21.js:1:3078
Audience from decoded token: did:web:enoki.us-east.host.bsky.network page-099e80a200860a21.js:1:3150
Extracted PDS endpoint from decoded token: https://enoki.us-east.host.bsky.network page-099e80a200860a21.js:1:3273
Using PDS endpoint for API requests: https://enoki.us-east.host.bsky.network page-099e80a200860a21.js:1:3533
Saving PDS endpoint to auth context: https://enoki.us-east.host.bsky.network page-099e80a200860a21.js:1:3587
Callback received state: 9StyI... page-099e80a200860a21.js:1:1095
Stored state: undefined... page-099e80a200860a21.js:1:1175
No stored OAuth state found. Session storage may have been cleared. 117-89c59c874aec3528.js:1:4081
Submitting status update with DID: did:plc:gq4fo3u6tqzzdkjlwzpb23tj page-1f5ea258c75e5bac.js:1:1200
Using PDS endpoint: https://enoki.us-east.host.bsky.network page-1f5ea258c75e5bac.js:1:1252
Checking auth with PDS endpoint: https://enoki.us-east.host.bsky.network 481-d3c58c35fd99af50.js:1:2469
Making auth check request to: https://enoki.us-east.host.bsky.network/xrpc/com.atproto.identity.resolveHandle?handle=atproto.com 481-d3c58c35fd99af50.js:1:2709
Auth check successful! 481-d3c58c35fd99af50.js:1:2856
Authentication verified, creating status... page-1f5ea258c75e5bac.js:1:1662
Creating flushing status (attempt 1/3) with nonce: null 481-d3c58c35fd99af50.js:1:4526
Using PDS endpoint: https://enoki.us-east.host.bsky.network 481-d3c58c35fd99af50.js:1:4608
API endpoint: https://enoki.us-east.host.bsky.network/xrpc/com.atproto.repo.createRecord 481-d3c58c35fd99af50.js:1:4985
Generating DPoP token for: https://enoki.us-east.host.bsky.network/xrpc/com.atproto.repo.createRecord with nonce: none 481-d3c58c35fd99af50.js:1:5050
Sending request to proxy API... 481-d3c58c35fd99af50.js:1:5174
XHRPOST
https://flushing.im/api/bluesky/flushing
[HTTP/2 401  200ms]

Status creation error: 
Object { error: "use_dpop_nonce", nonce: "Cu3Gn9OQuKUyKfqV9bGK0pqqeHPvm-tWhsvc9-6cmkA", originalError: {…} }
117-89c59c874aec3528.js:1:4081
Received DPoP nonce error, retrying with nonce: Cu3Gn9OQuKUyKfqV9bGK0pqqeHPvm-tWhsvc9-6cmkA 481-d3c58c35fd99af50.js:1:5620
Creating flushing status (attempt 2/3) with nonce: Cu3Gn9OQuKUyKfqV9bGK0pqqeHPvm-tWhsvc9-6cmkA 481-d3c58c35fd99af50.js:1:4526
Using PDS endpoint: https://enoki.us-east.host.bsky.network 481-d3c58c35fd99af50.js:1:4608
API endpoint: https://enoki.us-east.host.bsky.network/xrpc/com.atproto.repo.createRecord 481-d3c58c35fd99af50.js:1:4985
Generating DPoP token for: https://enoki.us-east.host.bsky.network/xrpc/com.atproto.repo.createRecord with nonce: Cu3Gn9OQuKUyKfqV9bGK0pqqeHPvm-tWhsvc9-6cmkA 481-d3c58c35fd99af50.js:1:5050
Sending request to proxy API... 481-d3c58c35fd99af50.js:1:5174
XHRPOST
https://flushing.im/api/bluesky/flushing
[HTTP/2 401  63ms]

Status creation error: 
Object { error: "use_dpop_nonce", nonce: "Cu3Gn9OQuKUyKfqV9bGK0pqqeHPvm-tWhsvc9-6cmkA", originalError: {…} }
117-89c59c874aec3528.js:1:4081
Received DPoP nonce error, retrying with nonce: Cu3Gn9OQuKUyKfqV9bGK0pqqeHPvm-tWhsvc9-6cmkA 481-d3c58c35fd99af50.js:1:5620
Creating flushing status (attempt 3/3) with nonce: Cu3Gn9OQuKUyKfqV9bGK0pqqeHPvm-tWhsvc9-6cmkA 481-d3c58c35fd99af50.js:1:4526
Using PDS endpoint: https://enoki.us-east.host.bsky.network 481-d3c58c35fd99af50.js:1:4608
API endpoint: https://enoki.us-east.host.bsky.network/xrpc/com.atproto.repo.createRecord 481-d3c58c35fd99af50.js:1:4985
Generating DPoP token for: https://enoki.us-east.host.bsky.network/xrpc/com.atproto.repo.createRecord with nonce: Cu3Gn9OQuKUyKfqV9bGK0pqqeHPvm-tWhsvc9-6cmkA 481-d3c58c35fd99af50.js:1:5050
Sending request to proxy API... 481-d3c58c35fd99af50.js:1:5174
XHRPOST
https://flushing.im/api/bluesky/flushing
[HTTP/2 401  102ms]

Status creation error: 
Object { error: "use_dpop_nonce", nonce: "Cu3Gn9OQuKUyKfqV9bGK0pqqeHPvm-tWhsvc9-6cmkA", originalError: {…} }
117-89c59c874aec3528.js:1:4081
Received DPoP nonce error, retrying with nonce: Cu3Gn9OQuKUyKfqV9bGK0pqqeHPvm-tWhsvc9-6cmkA 481-d3c58c35fd99af50.js:1:5620
Failed to update status: Error: Maximum retry attempts reached. Could not create status after 3 attempts.
    NextJS 34
117-89c59c874aec3528.js:1:4081
