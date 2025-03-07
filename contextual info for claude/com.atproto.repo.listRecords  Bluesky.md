---
title: "com.atproto.repo.listRecords | Bluesky"
source: "https://docs.bsky.app/docs/api/com-atproto-repo-list-records"
author:
published:
created: 2025-03-07
description: "*This endpoint is part of the atproto PDS repository management APIs. Requests usually require authentication (unlike the `com.atproto.sync.*` endpoints), and are made directly to the user's own PDS instance.*"
tags:
  - "clippings"
---
```
GET /xrpc/com.atproto.repo.listRecords
```

*This endpoint is part of the atproto PDS repository management APIs. Requests usually require authentication (unlike the `com.atproto.sync.*` endpoints), and are made directly to the user's own PDS instance.*

*To learn more about calling atproto API endpoints like this one, see the [API Hosts and Auth](https://docs.bsky.app/docs/advanced-guides/api-directory) guide.*

List a range of records in a repository, matching a specific collection. Does not require auth.

## Request​

### Query Parameters

**repo** at-identifierrequired

The handle or DID of the repo.

**collection** nsidrequired

The NSID of the record type.

**limit** integer

**Possible values:** `>= 1` and `<= 100`

The number of records to return.

**Default value:** `50`

**cursor** string

**reverse** boolean

Flag to reverse the order of the returned records.

- application/json

- Schema
- Example (auto)