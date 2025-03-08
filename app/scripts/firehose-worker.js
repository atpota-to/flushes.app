const WebSocket = require("ws");
const { createClient } = require("@supabase/supabase-js");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") }); // Load environment variables from .env file in app root

const JETSTREAM_URL = "wss://jetstream2.us-west.bsky.network/subscribe";
const FLUSHING_STATUS_NSID = "im.flushing.right.now";

// Supabase setup from .env file
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to your .env file");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Ensure the table exists
async function setupDatabase() {
    try {
        console.log("Setting up database...");
        
        // Check if the table already exists
        const { error: queryError } = await supabase
            .from('flushing_records')
            .select('id', { count: 'exact', head: true });
        
        // If no error, table exists
        if (!queryError) {
            console.log("Table 'flushing_records' already exists");
            return;
        }
        
        // Create the table using SQL
        const { error: sqlError } = await supabase.sql`
            CREATE TABLE IF NOT EXISTS flushing_records (
                id SERIAL PRIMARY KEY,
                did TEXT NOT NULL,
                collection TEXT NOT NULL,
                type TEXT NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE NOT NULL,
                emoji TEXT,
                text TEXT,
                cid TEXT NOT NULL,
                uri TEXT UNIQUE NOT NULL,
                indexed_at TIMESTAMP WITH TIME ZONE DEFAULT now()
            );
            
            CREATE INDEX IF NOT EXISTS flushing_records_did_idx ON flushing_records(did);
        `;
        
        if (sqlError) {
            console.error("Error creating table:", sqlError);
            process.exit(1);
        }
        console.log("Table created successfully");
    } catch (err) {
        console.error("Error setting up database:", err);
        process.exit(1);
    }
}

let messageCount = 0;
let flushingFoundCount = 0;

function connect() {
    console.log("Connecting to Jetstream");

    const wsUrl = JETSTREAM_URL + "?wantedCollections=" + FLUSHING_STATUS_NSID;
    const ws = new WebSocket(wsUrl);

    ws.on("open", () => {
        console.log("Connected to Jetstream");
    });

    ws.on("message", async (data) => {
        messageCount++;
        if (messageCount % 1000 === 0) {
            console.log("Messages:", messageCount);
        }

        try {
            const message = JSON.parse(data.toString());

            if (message.kind === "commit" &&
                message.commit &&
                message.commit.collection === FLUSHING_STATUS_NSID) {

                flushingFoundCount++;
                console.log("Found flushing record:", flushingFoundCount);
                console.log(JSON.stringify(message, null, 2));

                const recordPath = message.commit.collection + "/" + message.commit.rkey;
                const authorDid = message.did;
                const cid = message.commit.cid || "cid_" + Date.now();

                let recordText = "No text found";
                let recordEmoji = "🚽";
                let recordCreatedAt = new Date().toISOString();
                let recordType = FLUSHING_STATUS_NSID;

                if (message.commit.record) {
                    if (message.commit.record.text) {
                        recordText = message.commit.record.text;
                    }
                    if (message.commit.record.emoji) {
                        recordEmoji = message.commit.record.emoji;
                    }
                    if (message.commit.record.createdAt) {
                        recordCreatedAt = message.commit.record.createdAt;
                    }
                    if (message.commit.record.$type) {
                        recordType = message.commit.record.$type;
                    }
                }

                console.log("Author:", authorDid);
                console.log("Path:", recordPath);
                console.log("Text:", recordText);
                console.log("Emoji:", recordEmoji);
                console.log("Created at:", recordCreatedAt);

                const uri = "at://" + authorDid + "/" + recordPath;
                console.log("URI:", uri);

                // Save to Supabase
                try {
                    // Check if record already exists
                    const { data: existingData, error: checkError } = await supabase
                        .from("flushing_records")
                        .select("id")
                        .eq("uri", uri)
                        .limit(1);

                    if (checkError) {
                        console.error("Error checking for existing record:", checkError.message);
                        return;
                    }

                    if (existingData && existingData.length > 0) {
                        console.log("Record already exists, skipping");
                        return;
                    }

                    // Insert new record
                    const newRecord = {
                        did: authorDid,
                        collection: message.commit.collection,
                        type: recordType,
                        created_at: recordCreatedAt,
                        emoji: recordEmoji,
                        text: recordText,
                        cid: cid,
                        uri: uri
                    };

                    const { error: insertError } = await supabase
                        .from("flushing_records")
                        .insert(newRecord);

                    if (insertError) {
                        console.error("Error saving record:", insertError.message);
                    } else {
                        console.log("Record saved successfully");
                    }
                } catch (err) {
                    console.error("Error interacting with database:", err.message);
                }
            }
        } catch (err) {
            console.error("Error processing message:", err.message);
        }
    });

    ws.on("error", (error) => {
        console.error("WebSocket error:", error.message);
    });

    ws.on("close", () => {
        console.log("Connection closed, reconnecting in 5s");
        setTimeout(connect, 5000);
    });
}

// Start the worker
async function start() {
    await setupDatabase();
    connect();
}

// Run the worker
start();

process.on("SIGINT", () => {
    console.log("Shutting down");
    process.exit(0);
});