---
title: "Quick start guide to building applications on AT Protocol - AT Protocol"
source: "https://atproto.com/guides/applications"
author:
  - "[[AT Protocol]]"
published:
created: 2025-03-07
description: "In this guide, we're going to build a simple multi-user app that publishes your current \"status\" as an emoji."
tags:
  - "clippings"
---
[

Find the source code for the example application on GitHub.

](https://github.com/bluesky-social/statusphere-example-app)

In this guide, we're going to build a simple multi-user app that publishes your current "status" as an emoji. Our application will look like this:

![A screenshot of our example application](https://atproto.com/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fapp-screenshot.1d8d0740.png&w=1920&q=75)

We will cover how to:

- Signin via OAuth
- Fetch information about users (profiles)
- Listen to the network firehose for new data
- Publish data on the user's account using a custom schema

We're going to keep this light so you can quickly wrap your head around ATProto. There will be links with more information about each step.

Data in the Atmosphere is stored on users' personal repos. It's almost like each user has their own website. Our goal is to aggregate data from the users into our SQLite DB.

Think of our app like a Google. If Google's job was to say which emoji each website had under `/status.json`, then it would show something like:

- `nytimes.com` is feeling 📰 according to `https://nytimes.com/status.json`
- `bsky.app` is feeling 🦋 according to `https://bsky.app/status.json`
- `reddit.com` is feeling 🤓 according to `https://reddit.com/status.json`

The Atmosphere works the same way, except we're going to check `at://` instead of `https://`. Each user has a data repo under an `at://` URL. We'll crawl all the user data repos in the Atmosphere for all the "status.json" records and aggregate them into our SQLite database.

> `at://` is the URL scheme of the AT Protocol. Under the hood it uses common tech like HTTP and DNS, but it adds all of the features we'll be using in this tutorial.

Start by cloning the repo and installing packages.

Our repo is a regular Web app. We're rendering our HTML server-side like it's 1999. We also have a SQLite database that we're managing with [Kysely](https://kysely.dev/).

Our starting stack:

- Typescript
- NodeJS web server ([express](https://expressjs.com/))
- SQLite database ([Kysely](https://kysely.dev/))
- Server-side rendering ([uhtml](https://www.npmjs.com/package/uhtml))

With each step we'll explain how our Web app taps into the Atmosphere. Refer to the codebase for more detailed code — again, this tutorial is going to keep it light and quick to digest.

When somebody logs into our app, they'll give us read & write access to their personal `at://` repo. We'll use that to write the status json record.

We're going to accomplish this using OAuth ([spec](https://github.com/bluesky-social/proposals/tree/main/0004-oauth)). Most of the OAuth flows are going to be handled for us using the [@atproto/oauth-client-node](https://github.com/bluesky-social/atproto/tree/main/packages/oauth/oauth-client-node) library. This is the arrangement we're aiming toward:

![A diagram of the OAuth elements](https://atproto.com/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fdiagram-oauth.5ebec062.png&w=1920&q=75)

When the user logs in, the OAuth client will create a new session with their repo server and give us read/write access along with basic user info.

![A screenshot of the login UI](https://atproto.com/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fapp-login.83cd693f.png&w=1080&q=75)

Our login page just asks the user for their "handle," which is the domain name associated with their account. For [Bluesky](https://bsky.app/) users, these tend to look like `alice.bsky.social`, but they can be any kind of domain (eg `alice.com`).

When they submit the form, we tell our OAuth client to initiate the authorization flow and then redirect the user to their server to complete the process.

This is the same kind of SSO flow that Google or GitHub uses. The user will be asked for their password, then asked to confirm the session with your application.

When that finishes, the user will be sent back to `/oauth/callback` on our Web app. The OAuth client will store the access tokens for the user's server, and then we attach their account's [DID](https://atproto.com/specs/did) to the cookie-session.

With that, we're in business! We now have a session with the user's repo server and can use that to access their data.

Why don't we learn something about our user? In [Bluesky](https://bsky.app/), users publish a "profile" record which looks like this:

You can examine this record directly using [atproto-browser.vercel.app](https://atproto-browser.vercel.app/). For instance, [this is the profile record for @bsky.app](https://atproto-browser.vercel.app/at?u=at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.actor.profile/self).

We're going to use the [Agent](https://github.com/bluesky-social/atproto/tree/main/packages/api) associated with the user's OAuth session to fetch this record.

When asking for a record, we provide three pieces of information.

- **repo** The [DID](https://atproto.com/specs/did) which identifies the user,
- **collection** The collection name, and
- **rkey** The record key

We'll explain the collection name shortly. Record keys are strings with [some restrictions](https://atproto.com/specs/record-key#record-key-syntax) and a couple of common patterns. The `"self"` pattern is used when a collection is expected to only contain one record which describes the user.

Let's update our homepage to fetch this profile record:

With that data, we can give a nice personalized welcome banner for our user:

![A screenshot of the banner image](https://atproto.com/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fapp-banner.1e92c654.png&w=1080&q=75)

You can think of the user repositories as collections of JSON records:

![A diagram of a repository](https://atproto.com/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fdiagram-repo.4a34005b.png&w=1920&q=75)

Let's look again at how we read the "profile" record:

We write records using a similar API. Since our goal is to write "status" records, let's look at how that will happen:

Our `POST /status` route is going to use this API to publish the user's status to their repo.

Now in our homepage we can list out the status buttons:

And here we are!

![A screenshot of the app's status options](https://atproto.com/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fapp-status-options.6c0bfc19.png&w=1080&q=75)

Repo collections are typed, meaning that they have a defined schema. The `app.bsky.actor.profile` type definition [can be found here](https://github.com/bluesky-social/atproto/blob/main/lexicons/app/bsky/actor/profile.json).

Anybody can create a new schema using the [Lexicon](https://atproto.com/specs/lexicon) language, which is very similar to [JSON-Schema](http://json-schema.org/). The schemas use [reverse-DNS IDs](https://atproto.com/specs/nsid) which indicate ownership. In this demo app we're going to use `xyz.statusphere` which we registered specifically for this project (aka statusphere.xyz).

> ### Why create a schema?
> 
> Schemas help other applications understand the data your app is creating. By publishing your schemas, you make it easier for other application authors to publish data in a format your app will recognize and handle.

Let's create our schema in the `/lexicons` folder of our codebase. You can [read more about how to define schemas here](https://atproto.com/guides/lexicon).

Now let's run some code-generation using our schema:

This will produce Typescript interfaces as well as runtime validation functions that we can use in our app. Here's what that generated code looks like:

Let's use that code to improve the `POST /status` route:

So far, we have:

- Logged in via OAuth
- Created a custom schema
- Read & written records for the logged in user

Now we want to fetch the status records from other users.

Remember how we referred to our app as being like Google, crawling around the repos to get their records? One advantage we have in the AT Protocol is that each repo publishes an event log of their updates.

![A diagram of the event stream](https://atproto.com/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fdiagram-event-stream.aa119d83.png&w=1080&q=75)

Using a [Relay service](https://docs.bsky.app/docs/advanced-guides/federation-architecture#relay) we can listen to an aggregated firehose of these events across all users in the network. In our case what we're looking for are valid `xyz.statusphere.status` records.

Let's create a SQLite table to store these statuses:

Now we can write these statuses into our database as they arrive from the firehose:

You can almost think of information flowing in a loop:

![A diagram of the flow of information](https://atproto.com/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fdiagram-info-flow.ccf81d0b.png&w=1080&q=75)

Applications write to the repo. The write events are then emitted on the firehose where they're caught by the apps and ingested into their databases.

Why sync from the event log like this? Because there are other apps in the network that will write the records we're interested in. By subscribing to the event log, we ensure that we catch all the data we're interested in — including data published by other apps!

Now that we have statuses populating our SQLite, we can produce a timeline of status updates by users. We also use a [DID](https://atproto.com/specs/did)\-to-handle resolver so we can show a nice username with the statuses:

Our HTML can now list these status records:

![A screenshot of the app status timeline](https://atproto.com/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fapp-status-history.25e5d14a.png&w=640&q=75)

As a final optimization, let's introduce "optimistic updates."

Remember the information flow loop with the repo write and the event log?

![A diagram of the flow of information](https://atproto.com/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fdiagram-info-flow.ccf81d0b.png&w=1080&q=75)

Since we're updating our users' repos locally, we can short-circuit that flow to our own database:

![A diagram illustrating optimistic updates](https://atproto.com/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fdiagram-optimistic-update.ca3f4cf1.png&w=1080&q=75)

This is an important optimization to make, because it ensures that the user sees their own changes while using your app. When the event eventually arrives from the firehose, we just discard it since we already have it saved locally.

To do this, we just update `POST /status` to include an additional write to our SQLite DB:

You'll notice this code looks almost exactly like what we're doing in `ingester.ts`.

In this tutorial we've covered the key steps to building an atproto app. Data is published in its canonical form on users' `at://` repos and then aggregated into apps' databases to produce views of the network.

When building your app, think in these four key steps:

- Design the [Lexicon](https://atproto.com/guides/#) schemas for the records you'll publish into the Atmosphere.
- Create a database for aggregating the records into useful views.
- Build your application to write the records on your users' repos.
- Listen to the firehose to aggregate data across the network.

Remember this flow of information throughout:

![A diagram of the flow of information](https://atproto.com/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fdiagram-info-flow.ccf81d0b.png&w=1080&q=75)

This is how every app in the Atmosphere works, including the [Bluesky social app](https://bsky.app/).

If you want to practice what you've learned, here are some additional challenges you could try:

- Sync the profile records of all users so that you can show their display names instead of their handles.
- Count the number of each status used and display the total counts.
- Fetch the authed user's `app.bsky.graph.follow` follows and show statuses from them.
- Create a different kind of schema, like a way to post links to websites and rate them 1 through 4 stars.