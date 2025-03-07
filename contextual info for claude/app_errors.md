Storage access automatically granted for Dynamic State Partitioning “https://bsky.social” on “https://flushing.im”. callback
GET
https://flushing.im/favicon.ico
[HTTP/2 404  72ms]

Exchanging code for token... page-976d4b27123490e1.js:1:1598
No nonce provided, getting one from API... 481-7f188d0a0612edc0.js:1:6509
Obtained nonce from API: BfLNboXnaX-9cCRDyFnwxGI7xm_9OF1syNTUUMM3A7c 481-7f188d0a0612edc0.js:1:6586
Creating DPoP token with nonce: BfLNboXnaX-9cCRDyFnwxGI7xm_9OF1syNTUUMM3A7c 481-7f188d0a0612edc0.js:1:6698
Making token request via proxy API 481-7f188d0a0612edc0.js:1:6837
Token request successful 481-7f188d0a0612edc0.js:1:7330
Token audience: undefined page-976d4b27123490e1.js:1:1950
Token audience missing or not a string: undefined page-976d4b27123490e1.js:1:2208
Getting profile via proxy API 481-7f188d0a0612edc0.js:1:2377
Token response: 
Object { access_token: "eyJ0eXAiOiJhdCtqd3QiLCJhbGciOiJFUzI1NksifQ.eyJhdWQiOiJkaWQ6d2ViOmVub2tpLnVzLWVhc3QuaG9zdC5ic2t5Lm5ldHdvcmsiLCJpYXQiOjE3NDEzODg5MTUsImV4cCI6MTc0MTM5MjUxNSwic3ViIjoiZGlkOnBsYzpncTRmbzN1NnRxenpka2psd3pwYjIzdGoiLCJqdGkiOiJ0b2stZjcwMzk1Yzk0MzFkYWU2NDBhZTk4OGRkNGRjNWY0YTkiLCJjbmYiOnsiamt0IjoiUV9iMXlsWEZuRGU0TlF1SVBFNm4xOU5qWkhMaFZwOGlZMjZpblJrT24tVSJ9LCJjbGllbnRfaWQiOiJodHRwczovL2ZsdXNoaW5nLmltL2NsaWVudC1tZXRhZGF0YS5qc29uIiwic2NvcGUiOiJhdHByb3RvIHRyYW5zaXRpb246Z2VuZXJpYyIsImlzcyI6Imh0dHBzOi8vYnNreS5zb2NpYWwifQ.3cGPid5H_yCIKzVxFKpCpwXxYS0dK4ZyP16lXflPekSqA8uRpMiLTnUh9XnmXjpW7xmzauzMmyUgR03wbk5l9w", token_type: "DPoP", refresh_token: "ref-8a27b644c89f22ad6056da6b33670266c745f35136c125a8117c392f82945d53", scope: "atproto transition:generic", expires_in: 3599, sub: "did:plc:gq4fo3u6tqzzdkjlwzpb23tj" }
page-976d4b27123490e1.js:1:2465
User DID from token: did:plc:gq4fo3u6tqzzdkjlwzpb23tj page-976d4b27123490e1.js:1:2510
Decoded token payload: 
Object { aud: "did:web:enoki.us-east.host.bsky.network", iat: 1741388915, exp: 1741392515, sub: "did:plc:gq4fo3u6tqzzdkjlwzpb23tj", jti: "tok-f70395c9431dae640ae988dd4dc5f4a9", cnf: {…}, client_id: "https://flushing.im/client-metadata.json", scope: "atproto transition:generic", iss: "https://bsky.social" }
page-976d4b27123490e1.js:1:2649
Audience from decoded token: did:web:enoki.us-east.host.bsky.network page-976d4b27123490e1.js:1:2721
Updated PDS endpoint from decoded token: https://enoki.us-east.host.bsky.network page-976d4b27123490e1.js:1:2844
Using PDS endpoint for API requests: https://enoki.us-east.host.bsky.network page-976d4b27123490e1.js:1:3000
Submitting status update with DID: did:plc:gq4fo3u6tqzzdkjlwzpb23tj page-1700ee190f0631bf.js:1:1129
Creating flushing status with DPoP nonce: null page-1700ee190f0631bf.js:1:1412
User PDS endpoint: https://enoki.us-east.host.bsky.network page-1700ee190f0631bf.js:1:1471
Creating flushing status with nonce: null 481-7f188d0a0612edc0.js:1:3187
Using PDS endpoint: https://enoki.us-east.host.bsky.network 481-7f188d0a0612edc0.js:1:3241
Generating DPoP token for: https://enoki.us-east.host.bsky.network/xrpc/com.atproto.repo.createRecord 481-7f188d0a0612edc0.js:1:3423
Using PDS endpoint for DPoP token generation 481-7f188d0a0612edc0.js:1:3469
XHRPOST
https://flushing.im/api/bluesky/flushing
[HTTP/2 401  362ms]

Status creation error: 
Object { error: "use_dpop_nonce", nonce: "sP6OuVAHR5DNt9ZvpNqeWSdUOf4vA7cZ_9QEKEpa3O4", originalError: {…} }
117-9ca478b5e944a826.js:1:4081
Error creating flushing status: Error: Status creation failed: 401
    NextJS 31
117-9ca478b5e944a826.js:1:4081
Failed to update status: Error: Status creation failed: 401
    NextJS 31
117-9ca478b5e944a826.js:1:4081


Now, here is what I see in the network tab:

GET https://bsky.social/.well-known/oauth-authorization-server
    {"issuer":"https://bsky.social","request_parameter_supported":true,"request_uri_parameter_supported":true,"require_request_uri_registration":true,"scopes_supported":["atproto","transition:generic","transition:chat.bsky"],"subject_types_supported":["public"],"response_types_supported":["code"],"response_modes_supported":["query","fragment","form_post"],"grant_types_supported":["authorization_code","refresh_token"],"code_challenge_methods_supported":["S256"],"ui_locales_supported":["en-US"],"display_values_supported":["page","popup","touch"],"request_object_signing_alg_values_supported":["RS256","RS384","RS512","PS256","PS384","PS512","ES256","ES256K","ES384","ES512","none"],"authorization_response_iss_parameter_supported":true,"request_object_encryption_alg_values_supported":[],"request_object_encryption_enc_values_supported":[],"jwks_uri":"https://bsky.social/oauth/jwks","authorization_endpoint":"https://bsky.social/oauth/authorize","token_endpoint":"https://bsky.social/oauth/token","token_endpoint_auth_methods_supported":["none","private_key_jwt"],"token_endpoint_auth_signing_alg_values_supported":["RS256","RS384","RS512","PS256","PS384","PS512","ES256","ES256K","ES384","ES512"],"revocation_endpoint":"https://bsky.social/oauth/revoke","introspection_endpoint":"https://bsky.social/oauth/introspect","pushed_authorization_request_endpoint":"https://bsky.social/oauth/par","require_pushed_authorization_requests":true,"dpop_signing_alg_values_supported":["RS256","RS384","RS512","PS256","PS384","PS512","ES256","ES256K","ES384","ES512"],"client_id_metadata_document_supported":true}

    HTTP/2 200

OPTIONS https://bsky.social/.well-known/oauth-authorization-server

GET https://bsky.social/oauth/authorize?client_id=https%3A%2F%2Fflushing.im%2Fclient-metadata.json&response_type=code&redirect_uri=https%3A%2F%2Fflushing.im%2Fauth%2Fcallback&scope=atproto%20transition%3Ageneric&state=Plb-nCCv9X5xXjTqxGxmP3nAWIS8knqN&code_challenge=PwBcKwsexA8CReQuf6-BVwE70V7f4CkfyM4MhFCTQl0&code_challenge_method=S256

303 GET https://bsky.social/oauth/authorize/accept?request_uri=urn%3Aietf%3Aparams%3Aoauth%3Arequest_uri%3Areq-2358ef13f161e15e8da7dc386dffa21d&account_sub=did%3Aplc%3Agq4fo3u6tqzzdkjlwzpb23tj&client_id=https%3A%2F%2Fflushing.im%2Fclient-metadata.json&csrf_token=32ae873cb793ec45

103 GET https://flushing.im/auth/callback?iss=https%3A%2F%2Fbsky.social&state=Plb-nCCv9X5xXjTqxGxmP3nAWIS8knqN&code=cod-1146b2a18bbd2613f2e252b25a15004d7866a1649c52b853ec456fbfa479a18a

200 GET https://flushing.im/api/auth/nonce

200 POST https://flushing.im/api/auth/token

200 POST https://flushing.im/api/bluesky/profile

200 GET https://flushing.im/dashboard?_rsc=1ayzj

200 GET https://flushing.im/_next/static/chunks/app/dashboard/page-1700ee190f0631bf.js?dpl=dpl_HqagqRoXy9zV9KaxVMTzrzqDHy9y

401 POST https://flushing.im/api/bluesky/flushing
