I'm passing the env variables like this:

pm2 start /opt/firehose-worker/app/scripts/jetstream13-worker.js --name firehose-worker --env NEXT_PUBLIC_SUPABASE_URL=https://zdzjtziydmwkxbzlkwxv.supabase.co --env SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpkemp0eml5ZG13a3hiemxrd3h2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MTM5ODQ0MywiZXhwIjoyMDU2OTc0NDQzfQ.NF-bxFMB4kwbLXR4PWcbNp6FYBoPccMRZs6KtZif60k

And I get this:


0|firehose | No Supabase credentials found, running in log-only mode
0|firehose | Connecting to Jetstream...
0|firehose | Connected to Jetstream successfully!

0|firehose-worker  | FOUND A FLUSHING RECORD! Total found: 1
0|firehose-worker  | {
0|firehose-worker  |   "did": "did:plc:gq4fo3u6tqzzdkjlwzpb23tj",
0|firehose-worker  |   "time_us": 1741442662774073,
0|firehose-worker  |   "kind": "commit",
0|firehose-worker  |   "commit": {
0|firehose-worker  |     "rev": "3ljuovov4o52p",
0|firehose-worker  |     "operation": "create",
0|firehose-worker  |     "collection": "im.flushing.right.now",
0|firehose-worker  |     "rkey": "3ljuovouvtf2p",
0|firehose-worker  |     "record": {
0|firehose-worker  |       "$type": "im.flushing.right.now",
0|firehose-worker  |       "createdAt": "2025-03-08T14:04:22.617Z",
0|firehose-worker  |       "emoji": "💧",
0|firehose-worker  |       "text": "testing 123"
0|firehose-worker  |     },
0|firehose-worker  |     "cid": "bafyreif6yrp5fzban3bpr3cohww7wtqysvs3gkvcjv4q334spxtakz7zqu"
0|firehose-worker  |   }
0|firehose-worker  | }
0|firehose-worker  | Author DID: did:plc:gq4fo3u6tqzzdkjlwzpb23tj
0|firehose-worker  | Record path: im.flushing.right.now/3ljuovouvtf2p
0|firehose-worker  | Text: testing 123
0|firehose-worker  | Emoji: 💧
0|firehose-worker  | Created at: 2025-03-08T14:04:22.617Z
0|firehose-worker  | Full URI: at://did:plc:gq4fo3u6tqzzdkjlwzpb23tj/im.flushing.right.now/3ljuovouvtf2p
0|firehose-worker  | Missing required data, cannot create record

