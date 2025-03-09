const WebSocket = require("ws");
const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") }); // Load environment variables from .env file in app root

const JETSTREAM_URL = "wss://jetstream2.us-west.bsky.network/subscribe";
const FLUSHING_STATUS_NSID = "im.flushing.right.now";
const LOG_FILE = path.resolve(__dirname, "flushing-logs.jsonl");

console.log("Starting firehose worker with file storage");
console.log(`Will save records to: ${LOG_FILE}`);

// Create log directory if needed
const logDir = path.dirname(LOG_FILE);
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

// Function to append records to a log file
function saveRecord(record) {
    return new Promise((resolve, reject) => {
        const logEntry = JSON.stringify(record) + "\n";
        fs.appendFile(LOG_FILE, logEntry, (err) => {
            if (err) {
                console.error("Error writing to log file:", err);
                reject(err);
            } else {
                resolve({ success: true });
            }
        });
    });
}

// Test file writing on startup
async function setupSystem() {
    try {
        console.log("Testing file logging system...");
        
        // Test if we can write to the log file
        const testRecord = {
            type: "startup",
            timestamp: new Date().toISOString(),
            message: "Firehose worker started"
        };
        
        await saveRecord(testRecord);
        console.log("✅ File logging test successful");
        
        // Create stats counter file if it doesn't exist
        const statsFile = path.resolve(__dirname, "flushing-stats.json");
        if (!fs.existsSync(statsFile)) {
            const initialStats = {
                total_records: 0,
                start_time: new Date().toISOString(),
                last_update: new Date().toISOString()
            };
            fs.writeFileSync(statsFile, JSON.stringify(initialStats, null, 2));
            console.log("Created new stats file");
        }
        
    } catch (err) {
        console.error("Error setting up file logging:", err);
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

                // Save to log file
                try {
                    // Create a record with all the info we need - matching structure
                    const flushingRecord = {
                        did: authorDid,
                        collection: message.commit.collection,
                        type: recordType,
                        created_at: recordCreatedAt,
                        emoji: recordEmoji,
                        text: recordText,
                        cid: cid,
                        uri: uri,
                        handle: "unknown", // We'll add real handle resolution later
                        indexed_at: new Date().toISOString()
                    };
                    
                    // Save to file
                    console.log("Saving record to log file...");
                    const result = await saveRecord(flushingRecord);
                    
                    if (result.success) {
                        console.log("Record saved successfully!");
                        
                        // Update stats counter
                        try {
                            const statsFile = path.resolve(__dirname, "flushing-stats.json");
                            let stats = { total_records: 0 };
                            
                            if (fs.existsSync(statsFile)) {
                                stats = JSON.parse(fs.readFileSync(statsFile, 'utf8'));
                            }
                            
                            stats.total_records++;
                            stats.last_update = new Date().toISOString();
                            
                            fs.writeFileSync(statsFile, JSON.stringify(stats, null, 2));
                            
                            // Only log every 10 records to reduce noise
                            if (flushingFoundCount % 10 === 0) {
                                console.log(`Total records processed: ${stats.total_records}`);
                            }
                        } catch (statsErr) {
                            console.error("Error updating stats:", statsErr.message);
                        }
                    } else {
                        console.error("Failed to save record to file");
                    }
                    
                    // Keep track of how many records we've processed
                    if (flushingFoundCount % 50 === 0) {
                        console.log(`Processed ${flushingFoundCount} flushing records in this session`);
                    }
                    
                } catch (err) {
                    console.error("Error processing record:", err.message);
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
    await setupSystem();
    connect();
}

// Run the worker
start();

process.on("SIGINT", () => {
    console.log("Shutting down");
    process.exit(0);
});