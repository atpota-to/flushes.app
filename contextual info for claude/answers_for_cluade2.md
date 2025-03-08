1. Do you want to implement a server-side or client-side solution for the

firehose?

- I don't really know the difference, can you recommend? Maybe we start small and upgrade later?

1. Do you have a preferred WebSocket library for Node.js or the browser?

- my answer: I'm not sure, I don't know enough about this. Could you make a recommendation and we can try it and then change course later if needed?

1. How do you want to handle CBOR encoding/decoding?

- my answer: I'm not sure, recommend?

1. How many entries do you want to display in the feed?

- my answer: maybe like the last 20 to start?

1. Do you need historical data or just new activity?

- my answer: I'd like historically the last 20 ideally, would that be hard?

1. Any UI preferences for displaying the feed?

- my answer: let's do a simple clean list that shows the user handle, timestamp, emoji + text, and then if you click on thier username it takes you to their profile at https://bsky.app/profile/username.example

1. Authentication requirements for firehose access?

- I don't think it needs auth, can you check the documentation? Let me know what you need to proceed.

1. Do you want to filter the firehose for im.flushing.right.now records on

the server or client?

- I'm not sure, maybe client? what's easier?

1. Do you want to integrate this with a database for persistence?

- yeah I have a supabase account that i'd like to connect

1. Environment considerations

- Is this app deployed on a platform that supports WebSockets? I don't know, does Vercel support that?