⏺ Let's update the regex patterns to be more precise based on your feedback:

  cat > /opt/firehose-worker/app/scripts/regex-worker.js << 'EOL'
  const WebSocket = require("ws");
  const { createClient } = require("@supabase/supabase-js");

  // Constants
  const FIREHOSE_URL =
  "wss://bsky.network/xrpc/com.atproto.sync.subscribeRepos";
  const FLUSHING_STATUS_NSID = "im.flushing.right.now";

  // Supabase setup
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let supabase = null;

  if (supabaseUrl && supabaseKey) {
    console.log("Supabase credentials found, connecting...");
    supabase = createClient(supabaseUrl, supabaseKey);
  } else {
    console.log("No Supabase credentials found, running in log-only mode");
  }

  // Initialize WebSocket and counters
  let ws = null;
  let messageCount = 0;
  let flushingFoundCount = 0;

  // Main connection function
  function connect() {
    console.log("Connecting to Bluesky firehose...");

    ws = new WebSocket(FIREHOSE_URL);

    ws.on("open", () => {
      console.log("Connected to firehose successfully!");
    });

    ws.on("message", async (data) => {
      messageCount++;

      // Log message count periodically
      if (messageCount % 1000 === 0) {
        console.log("Messages received:", messageCount);
      }

      // Check for flushing records
      const strData = data.toString();
      if (strData.includes(FLUSHING_STATUS_NSID)) {
        try {
          flushingFoundCount++;
          console.log("FOUND A FLUSHING RECORD! Total found:",
  flushingFoundCount);
          console.log("----------START RAW DATA LOG----------");
          console.log(strData);
          console.log("----------END RAW DATA LOG----------");

          // DID extraction - exact length pattern for did:plc:XXX
          let authorDid = null;
          const didMatch = strData.match(/did:plc:[a-z0-9]{24}/);
          if (didMatch) {
            authorDid = didMatch[0];
            console.log("Author DID:", authorDid);
          }

          // Path extraction - look for the NS with exact record ID length
          let recordPath = null;
          const pathMatch = strData.match(new RegExp(FLUSHING_STATUS_NSID +
  "/([a-z0-9]{11}[a-z0-9]*)"));
          if (pathMatch) {
            recordPath = FLUSHING_STATUS_NSID + "/" +
  pathMatch[1].substring(0, 11); // Take just first 11 chars
            console.log("Record path:", recordPath);
          }

          // CID extraction - just use a timestamp for now
          const cid = "cid_" + Date.now();

          // Extract text - looking for the content between dtext and e$type
          let text = "No text found";
          // Try to find text by looking for the sequence: dtext, length
  indicator, content
          // More greedy pattern to capture spaces and special chars
          const textMatch = strData.match(/dtext[a-z]([^e$]+)/);
          if (textMatch) {
            text = textMatch[1];
            console.log("Text:", text);
          }

          // Extract emoji - looking specifically for emoji character
          let emoji = "🚽"; // Default emoji
          const emojiMatch = strData.match(/eemoji[a-z]([^i]+)/);
          if (emojiMatch) {
            emoji = emojiMatch[1];
            console.log("Emoji:", emoji);
          }

          // Extract createdAt - ISO format date
          let createdAt = new Date().toISOString();
          const createdAtMatch =
  strData.match(/icreatedAt[a-z]([\d-]+T[\d:.]+Z)/);
          if (createdAtMatch) {
            createdAt = createdAtMatch[1];
            console.log("Created at:", createdAt);
          }

          // Only proceed if we have the minimum required data
          if (authorDid && recordPath) {
            // Create URI
            const uri = "at://" + authorDid + "/" + recordPath;
            console.log("Full URI:", uri);

            // If Supabase is configured, store the record
            if (supabase) {
              try {
                // Check if the record already exists
                const { data: existingData, error: existingError } = await
  supabase
                  .from("flushing_entries")
                  .select("id")
                  .eq("uri", uri)
                  .limit(1);

                if (existingError) {
                  console.error("Error checking existing record:",
  existingError.message);
                } else if (existingData && existingData.length > 0) {
                  console.log("Record already exists, skipping");
                } else {
                  // Create the record with the extracted data
                  const record = {
                    uri: uri,
                    cid: cid,
                    author_did: authorDid,
                    author_handle: null,  // Skip handle resolution for now
                    text: text,
                    emoji: emoji,
                    created_at: createdAt
                  };

                  console.log("Saving record to Supabase:",
  JSON.stringify(record));

                  const { error } = await supabase
                    .from("flushing_entries")
                    .insert(record);

                  if (error) {
                    console.error("Error storing record:", error.message);
                  } else {
                    console.log("Successfully stored record in Supabase!");
                  }
                }
              } catch (err) {
                console.error("Supabase operation error:", err.message);
              }
            }
          } else {
            console.log("Missing required data, cannot create record");
          }
        } catch (err) {
          console.error("Error processing flushing record:", err.message);
        }
      }
    });

    ws.on("error", (error) => {
      console.error("WebSocket error:", error.message);
    });

    ws.on("close", () => {
      console.log("Connection closed, reconnecting in 5 seconds...");
      setTimeout(connect, 5000);
    });
  }

  // Start the connection
  connect();

  // Handle termination
  process.on("SIGINT", () => {
    console.log("Shutting down...");
    if (ws) ws.close();
    process.exit(0);
  });
