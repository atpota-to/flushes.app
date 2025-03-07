Storage access automatically granted for Dynamic State Partitioning “https://bsky.social” on “https://flushing.im”. callback
GET
https://flushing.im/favicon.ico
[HTTP/2 404  0ms]

Callback received state: sKbxR... page-a2b4c23153d80106.js:1:993
Stored state: sKbxR... page-a2b4c23153d80106.js:1:1073
Exchanging code for token... page-a2b4c23153d80106.js:1:1914
No nonce provided, getting one from API... 481-38cee1d3cffbeb60.js:1:8815
Obtained nonce from API: jEDudu85YaVxa83p3YzTLY4VYmRv2O6VpyOwSkZtXu8 481-38cee1d3cffbeb60.js:1:8892
Creating DPoP token with nonce: jEDudu85YaVxa83p3YzTLY4VYmRv2O6VpyOwSkZtXu8 481-38cee1d3cffbeb60.js:1:9004
Making token request via proxy API 481-38cee1d3cffbeb60.js:1:9143
Token request successful 481-38cee1d3cffbeb60.js:1:9636
Token audience: undefined page-a2b4c23153d80106.js:1:2266
Token audience missing or not a string: undefined page-a2b4c23153d80106.js:1:2524
Getting profile via proxy API 481-38cee1d3cffbeb60.js:1:3562
Adding ath claim to DPoP token 481-38cee1d3cffbeb60.js:1:6994
Token response: 
Object { access_token: "eyJ0eXAiOiJhdCtqd3QiLCJhbGciOiJFUzI1NksifQ.eyJhdWQiOiJkaWQ6d2ViOmVub2tpLnVzLWVhc3QuaG9zdC5ic2t5Lm5ldHdvcmsiLCJpYXQiOjE3NDEzOTEwMzUsImV4cCI6MTc0MTM5NDYzNSwic3ViIjoiZGlkOnBsYzpncTRmbzN1NnRxenpka2psd3pwYjIzdGoiLCJqdGkiOiJ0b2stMDU0ZTAyMjI4MTcxYTNlMDcyYTNhODQ0Y2I4Njk1YTciLCJjbmYiOnsiamt0IjoiNVltV1k3SE5zM3BGdFVEd1VlaGlpbkxEYXdXR1Z3VXU5dUNEZUxmVURhSSJ9LCJjbGllbnRfaWQiOiJodHRwczovL2ZsdXNoaW5nLmltL2NsaWVudC1tZXRhZGF0YS5qc29uIiwic2NvcGUiOiJhdHByb3RvIHRyYW5zaXRpb246Z2VuZXJpYyIsImlzcyI6Imh0dHBzOi8vYnNreS5zb2NpYWwifQ.k6Z977hSzPqhljN1wje06apxn_uBxZajHWiSCulboe4kxCOrn_iHUd7-ANMXo2YwSGz5rQL-t-KeZv-IKyBzlw", token_type: "DPoP", refresh_token: "ref-d556158ae379dd4dae168f84b27a214c2a8e044d506d95c9f4c5ec8c25dca656", scope: "atproto transition:generic", expires_in: 3599, sub: "did:plc:gq4fo3u6tqzzdkjlwzpb23tj" }
page-a2b4c23153d80106.js:1:2781
User DID from token: did:plc:gq4fo3u6tqzzdkjlwzpb23tj page-a2b4c23153d80106.js:1:2826
Decoded token payload: 
Object { aud: "did:web:enoki.us-east.host.bsky.network", iat: 1741391035, exp: 1741394635, sub: "did:plc:gq4fo3u6tqzzdkjlwzpb23tj", jti: "tok-054e02228171a3e072a3a844cb8695a7", cnf: {…}, client_id: "https://flushing.im/client-metadata.json", scope: "atproto transition:generic", iss: "https://bsky.social" }
page-a2b4c23153d80106.js:1:2976
Audience from decoded token: did:web:enoki.us-east.host.bsky.network page-a2b4c23153d80106.js:1:3048
Extracted PDS endpoint from decoded token: https://enoki.us-east.host.bsky.network page-a2b4c23153d80106.js:1:3171
Using PDS endpoint for API requests: https://enoki.us-east.host.bsky.network page-a2b4c23153d80106.js:1:3431
Saving PDS endpoint to auth context: https://enoki.us-east.host.bsky.network page-a2b4c23153d80106.js:1:3485
Callback received state: sKbxR... page-a2b4c23153d80106.js:1:993
Stored state: undefined... page-a2b4c23153d80106.js:1:1073
No stored OAuth state found. Browser storage may have been cleared. 117-9a2b9731dac7965d.js:1:4081
Submitting status update with DID: did:plc:gq4fo3u6tqzzdkjlwzpb23tj page-1f5ea258c75e5bac.js:1:1200
Using PDS endpoint: https://enoki.us-east.host.bsky.network page-1f5ea258c75e5bac.js:1:1252
Checking auth with PDS endpoint: https://enoki.us-east.host.bsky.network 481-38cee1d3cffbeb60.js:1:2469
Adding ath claim to DPoP token 481-38cee1d3cffbeb60.js:1:6994
Making auth check request to: https://enoki.us-east.host.bsky.network/xrpc/com.atproto.identity.resolveHandle?handle=atproto.com 481-38cee1d3cffbeb60.js:1:2711
Auth check successful! 481-38cee1d3cffbeb60.js:1:2858
Authentication verified, creating status... page-1f5ea258c75e5bac.js:1:1662
Creating flushing status (attempt 1/3) with nonce: null 481-38cee1d3cffbeb60.js:1:4530
Using PDS endpoint: https://enoki.us-east.host.bsky.network 481-38cee1d3cffbeb60.js:1:4612
API endpoint: https://enoki.us-east.host.bsky.network/xrpc/com.atproto.repo.createRecord 481-38cee1d3cffbeb60.js:1:4989
Generating DPoP token for: https://enoki.us-east.host.bsky.network/xrpc/com.atproto.repo.createRecord with nonce: none 481-38cee1d3cffbeb60.js:1:5054
Including access token hash (ath) in DPoP token 481-38cee1d3cffbeb60.js:1:5122
Adding ath claim to DPoP token 481-38cee1d3cffbeb60.js:1:6994
Sending request to proxy API... 481-38cee1d3cffbeb60.js:1:5243
XHRPOST
https://flushing.im/api/bluesky/flushing
[HTTP/2 401  203ms]

Status creation error: 
Object { error: "use_dpop_nonce", nonce: "nceSKdZmf25ZbombMTLHUIw9I0Ss1PobvE6nqZOKAR0", originalError: {…} }
117-9a2b9731dac7965d.js:1:4081
    NextJS 32
Received DPoP nonce error, retrying with nonce: nceSKdZmf25ZbombMTLHUIw9I0Ss1PobvE6nqZOKAR0 481-38cee1d3cffbeb60.js:1:5689
Creating flushing status (attempt 2/3) with nonce: nceSKdZmf25ZbombMTLHUIw9I0Ss1PobvE6nqZOKAR0 481-38cee1d3cffbeb60.js:1:4530
Using PDS endpoint: https://enoki.us-east.host.bsky.network 481-38cee1d3cffbeb60.js:1:4612
API endpoint: https://enoki.us-east.host.bsky.network/xrpc/com.atproto.repo.createRecord 481-38cee1d3cffbeb60.js:1:4989
Generating DPoP token for: https://enoki.us-east.host.bsky.network/xrpc/com.atproto.repo.createRecord with nonce: nceSKdZmf25ZbombMTLHUIw9I0Ss1PobvE6nqZOKAR0 481-38cee1d3cffbeb60.js:1:5054
Including access token hash (ath) in DPoP token 481-38cee1d3cffbeb60.js:1:5122
Adding ath claim to DPoP token 481-38cee1d3cffbeb60.js:1:6994
Sending request to proxy API... 481-38cee1d3cffbeb60.js:1:5243
Status update successful! 481-38cee1d3cffbeb60.js:1:5492
Status update result: 
Object { uri: "at://did:plc:gq4fo3u6tqzzdkjlwzpb23tj/im.flushing.right.now/3ljt6tf5x4l2h", cid: "bafyreihsj6n5u72js5zfibc56ng2qpmglrljmjfx7aabyr3sogwwx5jm4q", commit: {…}, validationStatus: "unknown" }
page-1f5ea258c75e5bac.js:1:1763
