const WebSocket = require("ws");
const { createClient } = require("@supabase/supabase-js");

const JETSTREAM_URL = "wss://jetstream2.us-west.bsky.network/subscribe";
const FLUSHING_STATUS_NSID = "im.flushing.right.now";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
let supabase = null;

if (supabaseUrl && supabaseKey) {
    console.log("Connected to Supabase");
    supabase = createClient(supabaseUrl, supabaseKey);
} else {
    console.log("No Supabase credentials found");
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
        }

        console.log("Author:", authorDid);
        console.log("Path:", recordPath);
        console.log("Text:", recordText);
        console.log("Emoji:", recordEmoji);
        console.log("Created at:", recordCreatedAt);

        const uri = "at://" + authorDid + "/" + recordPath;
        console.log("URI:", uri);

        if (supabase && message.commit.operation !== "delete") {
            try {
            const { data: existingData, error: existingError } = await supabase
                .from("flushing_entries")
                .select("id")
                .eq("uri", uri)
                .limit(1);

            if (existingError) {
                console.error("Error checking record:", existingError.message);
            } else if (existingData && existingData.length > 0) {
                console.log("Record exists, skipping");
            } else {
                const record = {
                uri: uri,
                cid: cid,
                author_did: authorDid,
                author_handle: null,
                text: recordText,
                emoji: recordEmoji,
                created_at: recordCreatedAt
                };

                console.log("Saving to Supabase");

                const { error } = await supabase
                .from("flushing_entries")
                .insert(record);

                if (error) {
                console.error("Error:", error.message);
                } else {
                console.log("Success");
                }
            }
            } catch (err) {
            console.error("Error:", err.message);
            }
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

connect();

process.on("SIGINT", () => {
    console.log("Shutting down");
    process.exit(0);
});