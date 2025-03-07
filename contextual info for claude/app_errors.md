Storage access automatically granted for Dynamic State Partitioning “https://bsky.social” on “https://flushing.im”. callback
GET
https://flushing.im/favicon.ico
[HTTP/2 404  114ms]

Exchanging code for token... page-f39c9aca7f9cef21.js:1:1598
No nonce provided, getting one from API... 481-9e09ac8654971c06.js:1:6311
Obtained nonce from API: IqtXAD77JvClwyyCrUEl046AEYheHf8K__TPXGe8JNM 481-9e09ac8654971c06.js:1:6388
Creating DPoP token with nonce: IqtXAD77JvClwyyCrUEl046AEYheHf8K__TPXGe8JNM 481-9e09ac8654971c06.js:1:6500
Making token request via proxy API 481-9e09ac8654971c06.js:1:6639
Token request successful 481-9e09ac8654971c06.js:1:7132
Getting profile via proxy API 481-9e09ac8654971c06.js:1:2377
Token response: 
Object { access_token: "eyJ0eXAiOiJhdCtqd3QiLCJhbGciOiJFUzI1NksifQ.eyJhdWQiOiJkaWQ6d2ViOmVub2tpLnVzLWVhc3QuaG9zdC5ic2t5Lm5ldHdvcmsiLCJpYXQiOjE3NDEzODg2NTcsImV4cCI6MTc0MTM5MjI1Nywic3ViIjoiZGlkOnBsYzpncTRmbzN1NnRxenpka2psd3pwYjIzdGoiLCJqdGkiOiJ0b2stNDA1M2FmZTE0OTVlMzc2MzQwNzEyOGU0Y2VlMDBmZTciLCJjbmYiOnsiamt0IjoiSEozaFdXak5tS2M5ekR3a3gxV2E0Y285TndQM3RTcllZZWNwb01jRmtzcyJ9LCJjbGllbnRfaWQiOiJodHRwczovL2ZsdXNoaW5nLmltL2NsaWVudC1tZXRhZGF0YS5qc29uIiwic2NvcGUiOiJhdHByb3RvIHRyYW5zaXRpb246Z2VuZXJpYyIsImlzcyI6Imh0dHBzOi8vYnNreS5zb2NpYWwifQ.dA0_Pek7pe-QQ_IpFu1OVVGQekPUpnbkoyZvIph_Zqg6RRce-SKOIhbm1kXvpz8gplz9iGxNBAf9pXQR3tP8kg", token_type: "DPoP", refresh_token: "ref-231d9cd63178019bf90e270f20bba01961ca47930a7172b381382ac8f9f30f82", scope: "atproto transition:generic", expires_in: 3599, sub: "did:plc:gq4fo3u6tqzzdkjlwzpb23tj" }
page-f39c9aca7f9cef21.js:1:2302
User DID from token: did:plc:gq4fo3u6tqzzdkjlwzpb23tj page-f39c9aca7f9cef21.js:1:2347
Using PDS endpoint for API requests: null page-f39c9aca7f9cef21.js:1:2428
Submitting status update with DID: did:plc:gq4fo3u6tqzzdkjlwzpb23tj page-81bd0d9997f71f22.js:1:1129
Creating flushing status with DPoP nonce: null page-81bd0d9997f71f22.js:1:1412
User PDS endpoint: null page-81bd0d9997f71f22.js:1:1471
Creating flushing status with nonce: null 481-9e09ac8654971c06.js:1:3187
Using PDS endpoint: default 481-9e09ac8654971c06.js:1:3241
XHRPOST
https://flushing.im/api/bluesky/flushing
[HTTP/2 400  195ms]

Status creation error: 
Object { error: "InvalidToken", message: "OAuth tokens are meant for PDS access only", status: 400, details: {…} }
117-9155bb639739dea9.js:1:4081
Error creating flushing status: Error: Status creation failed: 400
    NextJS 31
117-9155bb639739dea9.js:1:4081
Failed to update status: Error: Status creation failed: 400
    NextJS 31
117-9155bb639739dea9.js:1:4081
