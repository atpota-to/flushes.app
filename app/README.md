# I'm Flushing

A React/Next.js application that allows users to login with their Bluesky account and set a status update with a custom lexicon schema called `im.flushing.right.now`.

## Features

- Bluesky OAuth authentication
- Custom lexicon schema for status updates
- Emoji selection
- Responsive design

## Tech Stack

- Next.js
- React
- TypeScript
- Bluesky AT Protocol

## Local Development

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

3. Start the development server:

```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Deployment

This application is designed to be deployed on Vercel with the domain `flushing.im`.

For production deployment:

1. Update the OAuth redirect URLs in both code and the Bluesky developer settings
2. Make sure the client metadata file is accessible at `https://flushing.im/client-metadata.json`
3. Deploy the application to Vercel

## Custom Lexicon Schema

This application uses a custom lexicon schema called `im.flushing.right.now` with the following structure:

```json
{
  "$type": "im.flushing.right.now",
  "text": "String - The status text",
  "emoji": "String - A single emoji character",
  "createdAt": "String - ISO timestamp"
}
```

## License

MIT