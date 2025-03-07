Storage access automatically granted for Dynamic State Partitioning “https://bsky.social” on “https://flushing.im”. callback
GET
https://flushing.im/favicon.ico
[HTTP/2 404  38ms]

Exchanging code for token... page-56b5a42e7fcb0b27.js:1:1805
No nonce provided, getting one from API... page-56b5a42e7fcb0b27.js:1:9009
Obtained nonce from API: NzTf9Bx5jLL1R62IjBahMbLI_Qf8fy_OHCZ4SiL4Zck page-56b5a42e7fcb0b27.js:1:9086
Creating DPoP token with nonce: NzTf9Bx5jLL1R62IjBahMbLI_Qf8fy_OHCZ4SiL4Zck page-56b5a42e7fcb0b27.js:1:9198
Making token request via proxy API page-56b5a42e7fcb0b27.js:1:9337
Token request successful page-56b5a42e7fcb0b27.js:1:9830
Getting profile via proxy API page-56b5a42e7fcb0b27.js:1:5274
Token response: 
Object { access_token: "eyJ0eXAiOiJhdCtqd3QiLCJhbGciOiJFUzI1NksifQ.eyJhdWQiOiJkaWQ6d2ViOmVub2tpLnVzLWVhc3QuaG9zdC5ic2t5Lm5ldHdvcmsiLCJpYXQiOjE3NDEzODc2NzMsImV4cCI6MTc0MTM5MTI3Mywic3ViIjoiZGlkOnBsYzpncTRmbzN1NnRxenpka2psd3pwYjIzdGoiLCJqdGkiOiJ0b2stN2NiYWVjYWM1YjZkODk3ZjA4YmNmYWEyZjkwOGFjOTUiLCJjbmYiOnsiamt0IjoiSXU5VXZZSWhsa1pZMG4wTmR3bDczLWhZR3FCM1Vhb1VVdnBZWGViVzBySSJ9LCJjbGllbnRfaWQiOiJodHRwczovL2ZsdXNoaW5nLmltL2NsaWVudC1tZXRhZGF0YS5qc29uIiwic2NvcGUiOiJhdHByb3RvIHRyYW5zaXRpb246Z2VuZXJpYyIsImlzcyI6Imh0dHBzOi8vYnNreS5zb2NpYWwifQ.m_A4mtkHeQdPVLnp9cF4Uv-hiZGpz51-FJPckjhvdPNzG2TOFGyzaRJB3qc8i9XoGAShoXLvK3LLPV4uQIEcDQ", token_type: "DPoP", refresh_token: "ref-a8783386c1bf1e98f2f909c3d5db9e99627ebafca9464ec07b7e2184657a4aba", scope: "atproto transition:generic", expires_in: 3599, sub: "did:plc:gq4fo3u6tqzzdkjlwzpb23tj" }
page-56b5a42e7fcb0b27.js:1:2332
User DID from token: did:plc:gq4fo3u6tqzzdkjlwzpb23tj page-56b5a42e7fcb0b27.js:1:2377
Submitting status update with DID: did:plc:gq4fo3u6tqzzdkjlwzpb23tj page-e3d3ed1dd8cf6880.js:1:1322
Creating flushing status with DPoP nonce: null page-e3d3ed1dd8cf6880.js:1:1605
Creating flushing status with nonce: null page-56b5a42e7fcb0b27.js:1:5971
XHRPOST
https://flushing.im/api/bluesky/flushing
[HTTP/2 400  149ms]

Status creation error: 
Object { error: "InvalidToken", message: "OAuth tokens are meant for PDS access only", status: 400, details: {…} }
117-066909c23495ad5e.js:1:4081
    NextJS 32
Error creating flushing status: Error: Status creation failed: 400
    NextJS 31
117-066909c23495ad5e.js:1:4081
Failed to update status: Error: Status creation failed: 400
    NextJS 31
117-066909c23495ad5e.js:1:4081


I added some documentation for one of Bluesky's createRecord APIs that is the API you can use to create record's on someone's PDS if you have auth. Not sure if that info is helpful.

contextual info for claude/com.atproto.repo.createRecord  Bluesky.md

Also, in another atproto app that I looked at, there seems to be a step where they are calling https://plc.directory/did:plc:gq4fo3u6tqzzdkjlwzpb23tj to get a serviceEndpoint before then calling https://enoki.us-east.host.bsky.network/.well-known/oauth-protected-resource and then https://bsky.social/.well-known/oauth-authorization-server 

Before that though they POST to https://bsky.social/oauth/token

POST /oauth/token HTTP/2
Host: bsky.social
User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:135.0) Gecko/20100101 Firefox/135.0
Accept: */*
Accept-Language: en-US,en;q=0.5
Accept-Encoding: gzip, deflate, br, zstd
Referer: https://pdsls.dev/
content-type: application/json
dpop: eyJ0eXAiOiJkcG9wK2p3dCIsImFsZyI6IkVTMjU2IiwiandrIjp7ImFsZyI6IkVTMjU2IiwiY3J2IjoiUC0yNTYiLCJrdHkiOiJFQyIsIngiOiJDZTk3c3F6ZEdDdlZLb0w5SlF4QWRkUWFWUDZJR0VqdEROTWVGRFE3VkdrIiwieSI6ImxTRDFsaEEtLXBxRU1ZTFVhMzRQWldqZExHdU5uYjdFaDNRTUFzRVJ6eEUifX0.eyJpc3MiOiJodHRwczovL3Bkc2xzLmRldi9jbGllbnQtbWV0YWRhdGEuanNvbiIsImlhdCI6MTc0MTM4Nzg5NiwianRpIjoiaDU5cWswMG1zODoyZHdoa2N5MDY3YXNrIiwiaHRtIjoiUE9TVCIsImh0dSI6Imh0dHBzOi8vYnNreS5zb2NpYWwvb2F1dGgvdG9rZW4iLCJub25jZSI6ImdtbmtCUzVGTlZSd3VGZElCUXdqcl8zZ2Q1UXFIM0lTVDhCRXoyRUpLN1UifQ.GWFLnqT0vigSfRIUewQ2yVFNvuAUQpEGs6W3oKkTjE9XP1kr76HA2o_fr6W6a3QOraPAOA_pVRWyNkZB7yZ4hA
Content-Length: 264
Origin: https://pdsls.dev
Connection: keep-alive
Sec-Fetch-Dest: empty
Sec-Fetch-Mode: cors
Sec-Fetch-Site: cross-site
Priority: u=4
Pragma: no-cache
Cache-Control: no-cache
TE: trailers

Then OPTIONS https://bsky.social/oauth/token

OPTIONS /oauth/token HTTP/2
Host: bsky.social
User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:135.0) Gecko/20100101 Firefox/135.0
Accept: */*
Accept-Language: en-US,en;q=0.5
Accept-Encoding: gzip, deflate, br, zstd
Access-Control-Request-Method: POST
Access-Control-Request-Headers: content-type,dpop
Referer: https://pdsls.dev/
Origin: https://pdsls.dev
Connection: keep-alive
Sec-Fetch-Dest: empty
Sec-Fetch-Mode: cors
Sec-Fetch-Site: cross-site
Priority: u=4
Pragma: no-cache
Cache-Control: no-cache
TE: trailers

Not sure if any of this helpful to you, disregard or ask me questions if needed