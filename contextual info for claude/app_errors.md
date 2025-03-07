Storage access automatically granted for Dynamic State Partitioning “https://bsky.social” on “https://flushing.im”. callback
GET
https://flushing.im/favicon.ico
[HTTP/2 404  58ms]

Exchanging code for token... page-ae3301580eb0dbbc.js:1:1598
No nonce provided, getting one from API... 481-5b7d3c6f8bc564a2.js:1:8088
Obtained nonce from API: Dq3xrB2CbvGOdqtF5avAauCvScf1FYV_QDmpQ8wZqG4 481-5b7d3c6f8bc564a2.js:1:8165
Creating DPoP token with nonce: Dq3xrB2CbvGOdqtF5avAauCvScf1FYV_QDmpQ8wZqG4 481-5b7d3c6f8bc564a2.js:1:8277
Making token request via proxy API 481-5b7d3c6f8bc564a2.js:1:8416
Token request successful 481-5b7d3c6f8bc564a2.js:1:8909
Token audience: undefined page-ae3301580eb0dbbc.js:1:1950
Token audience missing or not a string: undefined page-ae3301580eb0dbbc.js:1:2208
Getting profile via proxy API 481-5b7d3c6f8bc564a2.js:1:3263
Token response: 
Object { access_token: "eyJ0eXAiOiJhdCtqd3QiLCJhbGciOiJFUzI1NksifQ.eyJhdWQiOiJkaWQ6d2ViOmVub2tpLnVzLWVhc3QuaG9zdC5ic2t5Lm5ldHdvcmsiLCJpYXQiOjE3NDEzODk4NjEsImV4cCI6MTc0MTM5MzQ2MSwic3ViIjoiZGlkOnBsYzpncTRmbzN1NnRxenpka2psd3pwYjIzdGoiLCJqdGkiOiJ0b2stYTRkNzdkNmZkZmExMmUwODkzNWJjNTQwYTJjMDBkNTEiLCJjbmYiOnsiamt0IjoieVlqUjRmb0JVSXY0RzZCX21Kb29abmR5ZFBHcmtwZEpBeXVpTDk0RGl6VSJ9LCJjbGllbnRfaWQiOiJodHRwczovL2ZsdXNoaW5nLmltL2NsaWVudC1tZXRhZGF0YS5qc29uIiwic2NvcGUiOiJhdHByb3RvIHRyYW5zaXRpb246Z2VuZXJpYyIsImlzcyI6Imh0dHBzOi8vYnNreS5zb2NpYWwifQ.gtS_fu7hSVR6DLgC-DD4yKGianrn6mBhSAwN14_TytGm2QMwbHXbGYDzV3c0cOCZ_Kw5SmJLUUZDp-y4gWwLXA", token_type: "DPoP", refresh_token: "ref-315fa3def8f4c3a0faa828188205642b078d126c8a22f5a4b68d262e6aceba1f", scope: "atproto transition:generic", expires_in: 3599, sub: "did:plc:gq4fo3u6tqzzdkjlwzpb23tj" }
page-ae3301580eb0dbbc.js:1:2465
User DID from token: did:plc:gq4fo3u6tqzzdkjlwzpb23tj page-ae3301580eb0dbbc.js:1:2510
Decoded token payload: 
Object { aud: "did:web:enoki.us-east.host.bsky.network", iat: 1741389861, exp: 1741393461, sub: "did:plc:gq4fo3u6tqzzdkjlwzpb23tj", jti: "tok-a4d77d6fdfa12e08935bc540a2c00d51", cnf: {…}, client_id: "https://flushing.im/client-metadata.json", scope: "atproto transition:generic", iss: "https://bsky.social" }
page-ae3301580eb0dbbc.js:1:2649
Audience from decoded token: did:web:enoki.us-east.host.bsky.network page-ae3301580eb0dbbc.js:1:2721
Updated PDS endpoint from decoded token: https://enoki.us-east.host.bsky.network page-ae3301580eb0dbbc.js:1:2844
Using PDS endpoint for API requests: https://enoki.us-east.host.bsky.network page-ae3301580eb0dbbc.js:1:3000
Submitting status update with DID: did:plc:gq4fo3u6tqzzdkjlwzpb23tj page-d2f66577bcd815c7.js:1:1200
Using PDS endpoint: https://enoki.us-east.host.bsky.network page-d2f66577bcd815c7.js:1:1252
Checking auth with PDS endpoint: https://enoki.us-east.host.bsky.network 481-5b7d3c6f8bc564a2.js:1:2403
XHRGET
https://enoki.us-east.host.bsky.network/xrpc/com.atproto.repo.listRecords?limit=1
[HTTP/2 400  29ms]

Auth check failed with status: 400 117-6f305e70e5d65397.js:1:4081
    NextJS 32


Authentication check failed. Your login may have expired.