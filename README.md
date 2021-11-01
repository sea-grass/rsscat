# RSS Aggregator

## About

This is a simple RSS aggregator that lets you paste many RSS feeds and combine them into a single RSS feed.

You can see the project running live [here](https://rsscat.ceagrass.workers.dev/).

This project uses Cloudflare Workers to serve the UI and fetch, parse, and combine the RSS feeds. Cloudflare KV is used to for caching of source feeds and persistent storage to describe the aggregate feeds.

## Future Work

There are some known issues and some potential features that can be improved at a later date:

- Support edit functionality, so a user can add and remove sources for a feed they've created
- Fix issue where download button doesn't show up for items when an RSS feed is used in podcast apps
- XSL stylesheet support, to present the feed to the user in the browser before they decide to import it