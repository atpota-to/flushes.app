Storage access automatically granted for Dynamic State Partitioning “https://bsky.social” on “https://flushing.im”. callback
GET
https://flushing.im/favicon.ico
[HTTP/2 404  0ms]

Callback received state: wljhb... page-60ffa11c049607bc.js:1:993
Stored state: wljhb... page-60ffa11c049607bc.js:1:1073
Exchanging code for token... page-60ffa11c049607bc.js:1:1914
No nonce provided, getting one from API... 481-2dfa6219a8f21f6a.js:1:8851
Obtained nonce from API: 9DpBC732hMV3debYUi33tyx-RbrwdWgXi9KaVlQM55I 481-2dfa6219a8f21f6a.js:1:8928
Creating DPoP token with nonce: 9DpBC732hMV3debYUi33tyx-RbrwdWgXi9KaVlQM55I 481-2dfa6219a8f21f6a.js:1:9040
Making token request via proxy API 481-2dfa6219a8f21f6a.js:1:9179
Token request successful 481-2dfa6219a8f21f6a.js:1:9672
Token audience: undefined page-60ffa11c049607bc.js:1:2266
Token audience missing or not a string: undefined page-60ffa11c049607bc.js:1:2524
Getting profile via proxy API 481-2dfa6219a8f21f6a.js:1:3568
Looking up profile by handle: atproto.com 481-2dfa6219a8f21f6a.js:1:3945
User DID from token: did:plc:gq4fo3u6tqzzdkjlwzpb23tj page-60ffa11c049607bc.js:1:2789
Extracted PDS endpoint from decoded token: https://enoki.us-east.host.bsky.network page-60ffa11c049607bc.js:1:3043
Getting user handle from DID... page-60ffa11c049607bc.js:1:3334
Getting profile via proxy API 481-2dfa6219a8f21f6a.js:1:3568
Looking up profile by DID: did:plc:gq4fo3u6tqzzdkjlwzpb23tj 481-2dfa6219a8f21f6a.js:1:3808
Successfully resolved user handle: dame.is page-60ffa11c049607bc.js:1:3450
Using PDS endpoint for API requests: https://enoki.us-east.host.bsky.network page-60ffa11c049607bc.js:1:3586
Saving PDS endpoint to auth context: https://enoki.us-east.host.bsky.network page-60ffa11c049607bc.js:1:3640
Callback received state: wljhb... page-60ffa11c049607bc.js:1:993
Stored state: undefined... page-60ffa11c049607bc.js:1:1073
No stored OAuth state found. Browser storage may have been cleared. 117-4cdef2a370a17db4.js:1:4081
Submitting status update with DID: did:plc:gq4fo3u6tqzzdkjlwzpb23tj page-1f5ea258c75e5bac.js:1:1200
Using PDS endpoint: https://enoki.us-east.host.bsky.network page-1f5ea258c75e5bac.js:1:1252
Checking auth with PDS endpoint: https://enoki.us-east.host.bsky.network 481-2dfa6219a8f21f6a.js:1:2469
Making auth check request to: https://enoki.us-east.host.bsky.network/xrpc/com.atproto.identity.resolveHandle?handle=atproto.com 481-2dfa6219a8f21f6a.js:1:2711
Auth check successful! 481-2dfa6219a8f21f6a.js:1:2858
Authentication verified, creating status... page-1f5ea258c75e5bac.js:1:1662
Creating flushing status (attempt 1/3) with nonce: null 481-2dfa6219a8f21f6a.js:1:4747
Using PDS endpoint: https://enoki.us-east.host.bsky.network 481-2dfa6219a8f21f6a.js:1:4829
API endpoint: https://enoki.us-east.host.bsky.network/xrpc/com.atproto.repo.createRecord 481-2dfa6219a8f21f6a.js:1:5206
Sending request to proxy API... 481-2dfa6219a8f21f6a.js:1:5325
XHRPOST
https://flushing.im/api/bluesky/flushing
[HTTP/2 401  185ms]

Status creation error: 
Object { error: "use_dpop_nonce", nonce: "ZzP4OW52NUitqfzMIq5Ww_QPmZDKEmZBIkXHtvdkpNQ", originalError: {…} }
117-4cdef2a370a17db4.js:1:4081
Received DPoP nonce error, retrying with nonce: ZzP4OW52NUitqfzMIq5Ww_QPmZDKEmZBIkXHtvdkpNQ 481-2dfa6219a8f21f6a.js:1:5771
Creating flushing status (attempt 2/3) with nonce: ZzP4OW52NUitqfzMIq5Ww_QPmZDKEmZBIkXHtvdkpNQ 481-2dfa6219a8f21f6a.js:1:4747
Using PDS endpoint: https://enoki.us-east.host.bsky.network 481-2dfa6219a8f21f6a.js:1:4829
API endpoint: https://enoki.us-east.host.bsky.network/xrpc/com.atproto.repo.createRecord 481-2dfa6219a8f21f6a.js:1:5206
Sending request to proxy API... 481-2dfa6219a8f21f6a.js:1:5325
Status update successful! 481-2dfa6219a8f21f6a.js:1:5574
Status update result: 
Object { uri: "at://did:plc:gq4fo3u6tqzzdkjlwzpb23tj/im.flushing.right.now/3ljt7a3lfwh2s", cid: "bafyreigryxavwcjkdzuo3wt5przffjkxwmbk5p6krlmfspb3kmjee3erwa", commit: {…}, validationStatus: "unknown" }
page-1f5ea258c75e5bac.js:1:1763
