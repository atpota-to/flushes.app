---
title: "Lexicon - AT Protocol"
source: "https://atproto.com/guides/lexicon"
author:
  - "[[AT Protocol]]"
published:
created: 2025-03-07
description: "A schema-driven interoperability framework"
tags:
  - "clippings"
---
## Intro to Lexicon

Lexicon is a schema system used to define RPC methods and record types. Every Lexicon schema is written in JSON, in a format similar to [JSON-Schema](https://json-schema.org/) for defining constraints.

The schemas are identified using [NSIDs](https://atproto.com/specs/nsid) which are a reverse-DNS format. Here are some example API endpoints:

And here are some example record types:

The schema types, definition language, and validation constraints are described in the [Lexicon specification](https://atproto.com/specs/lexicon), and representations in JSON and CBOR are described in the [Data Model specification](https://atproto.com/specs/data-model).

**Interoperability.** An open network like atproto needs a way to agree on behaviors and semantics. Lexicon solves this while making it relatively simple for developers to introduce new schemas.

**Lexicon is not RDF.** While RDF is effective at describing data, it is not ideal for enforcing schemas. Lexicon is easier to use because it doesn't need the generality that RDF provides. In fact, Lexicon's schemas enable code-generation with types and validation, which makes life much easier!

The AT Protocol's API system, [XRPC](https://atproto.com/specs/xrpc), is essentially a thin wrapper around HTTPS. For example, a call to:

is actually just an HTTP request:

The schemas establish valid query parameters, request bodies, and response bodies.

With code-generation, these schemas become very easy to use:

Schemas define the possible values of a record. Every record has a "type" which maps to a schema and also establishes the URL of a record.

For instance, this "follow" record:

...would have a URL like:

...and a schema like:

Tokens declare global identifiers which can be used in data.

Let's say a record schema wanted to specify three possible states for a traffic light: 'red', 'yellow', and 'green'.

This is perfectly acceptable, but it's not extensible. You could never add new states, like "flashing yellow" or "purple" (who knows, it could happen).

To add flexibility, you could remove the enum constraint and just document the possible values:

This isn't bad, but it lacks specificity. People inventing new values for state are likely to collide with each other, and there won't be clear documentation on each state.

Instead, you can define Lexicon tokens for the values you use:

This gives us unambiguous values to use in our trafficLight state. The final schema will still use flexible validation, but other teams will have more clarity on where the values originate from and how to add their own:

Once a schema is published, it can never change its constraints. Loosening a constraint (adding possible values) will cause old software to fail validation for new data, and tightening a constraint (removing possible values) will cause new software to fail validation for old data. As a consequence, schemas may only add optional constraints to previously unconstrained fields.

If a schema must change a previously-published constraint, it should be published as a new schema under a new NSID.

Schemas are designed to be machine-readable and network-accessible. While it is not currently *required* that a schema is available on the network, it is strongly advised to publish schemas so that a single canonical & authoritative representation is available to consumers of the method.