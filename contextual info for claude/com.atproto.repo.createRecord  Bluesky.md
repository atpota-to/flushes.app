---
title: "com.atproto.repo.createRecord | Bluesky"
source: "https://docs.bsky.app/docs/api/com-atproto-repo-create-record"
author:
published:
created: 2025-03-07
description: "*This endpoint is part of the atproto PDS repository management APIs. Requests usually require authentication (unlike the `com.atproto.sync.*` endpoints), and are made directly to the user's own PDS instance.*"
tags:
  - "clippings"
---
- - [HTTP Reference](https://docs.bsky.app/docs/category/http-reference)
- com.atproto.repo.createRecord

```markdown
POST /xrpc/com.atproto.repo.createRecord
```

*This endpoint is part of the atproto PDS repository management APIs. Requests usually require authentication (unlike the `com.atproto.sync.*` endpoints), and are made directly to the user's own PDS instance.*

*To learn more about calling atproto API endpoints like this one, see the [API Hosts and Auth](https://docs.bsky.app/docs/advanced-guides/api-directory) guide.*

Create a single new repository record. Requires auth, implemented by PDS.

## Request​

- application/json

### Body**required**

**repo** at-identifierrequired

The handle or DID of the repo (aka, current account).

**collection** nsidrequired

The NSID of the record collection.

**rkey** record-key

The Record Key.

**Possible values:** `<= 512 characters`

**validate** boolean

Can be set to 'false' to skip Lexicon schema validation of record data, 'true' to require it, or leave unset to validate only for known Lexicons.

**swapCommit** cid

Compare and swap with the previous commit by CID.

- application/json

- Schema
- Example (auto)

**Schema**

**validationStatus** string

**Possible values:** \[`valid`, `unknown`\]

#### Authorization: http

```markdown
name: Bearertype: httpscheme: bearer
```

Request Collapse all

AuthBody required

```prism
{
  "repo": "string",
  "collection": "string",
  "rkey": "string",
  "validate": true,
  "record": {},
  "swapCommit": "string"
}
```

ResponseClear

Click the `Send API Request` button above and see the response here!