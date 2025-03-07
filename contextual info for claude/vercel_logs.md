API received pdsEndpoint: https://enoki.us-east.host.bsky.network
Using API URL: https://enoki.us-east.host.bsky.network/xrpc
Creating record with body: {"repo":"did:plc:gq4fo3u6tqzzdkjlwzpb23tj","collection":"im.flushing.right.now","record":{"$type":"im.flushing.right.now","text":"test","emoji":"🚽","createdAt":"2025-03-07T23:36:45.017Z"}}
Request headers: {"Content-Type":"application/json","Authorization":"DPoP eyJ0eXAiOi...","DPoP":"eyJhbGciOi..."}
Response headers: {"access-control-allow-origin":"*","access-control-expose-headers":"DPoP-Nonce, WWW-Authenticate","cache-control":"private","content-length":"60","content-type":"application/json; charset=utf-8","date":"Fri, 07 Mar 2025 23:36:45 GMT","dpop-nonce":"LlWfyMv8IBRNbacCkKvqPcPMHsLtVcQmr8pYXCISA8c","etag":"W/\"3c-fFVTtGbi81z3YpltLLm+eGgcNto\"","keep-alive":"timeout=90","strict-transport-security":"max-age=63072000","vary":"Authorization, Accept-Encoding","www-authenticate":"DPoP algs=\"RS256 RS384 RS512 PS256 PS384 PS512 ES256 ES256K ES384 ES512\", error=\"invalid_dpop_proof\", error_description=\"DPoP ath mismatch\"","x-powered-by":"Express"}
Create record response status: 401
Create record response: {"error":"invalid_dpop_proof","message":"DPoP ath mismatch"}
Received new DPoP nonce from PDS: LlWfyMv8IBRNbacCkKvqPcPMHsLtVcQmr8pYXCISA8c



1. No, I'm not using a private browsing window and I tried across other 
  browsers and see the same result. 
  
2. No CORS errors, but this is the originalError: 
  {
  	"originalError": {
  		"error": "use_dpop_nonce",
  		"message": "Authorization server requires nonce in DPoP proof"
  	}
  } 
  
3. I added a new file at "contextual info for claude/vercel_logs.md" where you can see the vercel logs. The hotsname of my deployed site is indeed flushing.im