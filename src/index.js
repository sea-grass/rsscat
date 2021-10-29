// Welcome to an RSS aggregator
// Enter a list of RSS feeds you'd like to transform into one feed, and you'll receive a custom RSS feed URL.
// The response from each unique URL will be cached for up to 1 hour.

import { Router } from 'itty-router';
import _ from 'lodash';
import { Feed } from 'feed';
import xml2js from 'xml2js';

const router = Router();

router.get("/", (request) => {
  return new Response(`
    <html>
      <head>
        <title>RSS Aggregator</title>
      </head>
      <body>
        <h1>RSS Aggregator</h1>
        <p class="subtitle">
          Developed by
          <a href="https://github.com/sea-grass">sea-grass</a>.
          You can find <a href="https://github.com/sea-grass/expiry">the source on GitHub</a>.
        </p>
        <h2>Already have a feed?</h2>
        <p>If you remember your feed id, paste it here to edit it.</p>
        <form action="/edit" method="POST">
          <label>
            Feed Id
            <input type="text" name="id" />
          </label>
          <button type="submit">Edit</button>
        </form>
      </body>
      <h2>Want to create a new aggregate feed?</h2>
      <p>If you want to create an aggregate RSS feed, enter a list of URLs, one per line, into the box below to generate it.</p>
      <form action="/create" method="POST">
        <label>
          RSS Feeds <br/>
          <textarea name="feeds">http://feeds.nightvalepresents.com/welcometonightvalepodcast?format=xml</textarea>
        </label>
        <br/>
        <button type="submit">Create</button>
      </form>
    </html>
  `, {
    headers: {
      'Content-Type': 'text/html'
    }
  });
});

router.post("/edit", async (request) => {
  /** @type {FormData} */
  const formData = await request.formData();
  const feedId = formData.get("id");
  if (!_.isString(feedId) || _.isEmpty(feedId)) {
    return new Response(null, {
      status: 302,
      headers: {
        'Location': '/'
      }
    });
  }

  const feed = await getFeedSources(feedId);

  if (!feed) {
    return new Response(null, {
      status: 302,
      headers: {
        'Location': '/'
      }
    });
  }

  return new Response("You made it to edit " + JSON.stringify([...formData.values()]) );
});

router.post("/create", async (request) => {
  /** @type {FormData} */
  const formData = await request.formData();
  const feedUrls = formData.get('feeds');
  if (!_.isString(feedUrls) || _.isEmpty(feedUrls)) {
    return new Response(null, {
      status: 302,
      headers: {
        'Location': '/'
      }
    });
  }

  const urls = feedUrls.split('\n');
  const feedId = generateFeedId();
  await FEEDS.put(feedId, JSON.stringify(urls));
  return new Response(null, {
    status: 302,
    headers: {
      'Location': '/feed/' + feedId
    }
  });
});

router.get('/feed/:id', async (request) => {
  const feedId = request.params.id;
  if (!_.isString(feedId) || _.isEmpty(feedId)) {
    return new Response(null, {
      status: 302,
      headers: {
        'Location': '/'
      }
    });
  }

  const feedSources = await getFeedSources(feedId);

  if (!feedSources) {
    return new Response("Not found", {
      status: 404
    });
  }

  const cachedFeed = await getCachedFeed(feedId);

  if (cachedFeed) {
    return new Response(cachedFeed);
  }

  const feed = await buildFeed(feedId, feedSources);

  putCachedFeed(feedId, feed);
  return new Response(feed.rss2(), {
    headers: {
      'Content-Type': 'application/rss+xml'
    }
  });
});

addEventListener('fetch', (event) => {
  event.respondWith(router.handle(event.request));
});

function getFeedSources(feedId) {
  return FEEDS.get(feedId)
    .then((value) => {
      if (_.isNil(value)) throw new Error("Feed not found");

      return JSON.parse(value);
    })
    .catch((error) => null);
}

function getCachedFeed(feedId) {
  return FEED_CACHE.get(feedId)
    .then((value) => {
      if (_.isNil(value)) throw new Error("Cached feed not found");

      return value;
    })
    .catch(() => null);
}

const parser = {
  enclosure(item) {
    if (item.enclosure && item.enclosure['$']) {
      const attr = item.enclosure['$'];
      return {
        url: attr.url,
        type: attr.type,
        length: attr.length
      }
    }
  }
};

async function buildFeed(feedId, feedSources) {
  const sourceFeeds = await Promise.all(feedSources.map(fetchFeed));
  const feed = new Feed({
    title: feedId,
    link: 'https://expiry.ceagrass.workers.dev/feed/'+feedId
  });

  for (let i = 0; i < sourceFeeds.length; i++) {
    const data = await xml2js.parseStringPromise(sourceFeeds[i]);
    const feedTitle = data.rss.channel[0].title[0];
    const items = data.rss.channel[0].item;
    for (let j = 0; j < items.length; j++) {
      const item = items[j];
      if (j === 0 && feedTitle === 'Archive 81') {
        console.log(Object.keys(item));
        console.log(item['itunes:author']);
        console.log(item.enclosure);
      }
      feed.addItem({
        title: item.title + ' :: ' + feedTitle,
        id: item.link,
        date: new Date(item.pubDate),
        description: item.description,
        author: item['itunes:author'],
        enclosure: parser.enclosure(item)
      });
    }
  }

  return feed;
}

function fetchFeed(sourceUrl) {
  return SOURCE_CACHE.get(sourceUrl)
    .then((value) => {
      if (_.isNil(value)) throw new Error("Source feed is not cached");

      return value;
    })
    .catch(async () => {
      const response = await fetch(sourceUrl);

      return response.text().then(responseText => {
        SOURCE_CACHE.put(sourceUrl, responseText, {
          expirationTtl: 60 * 60 // expire in 1 hour
        });

        return responseText;
      });
    });
}

function putCachedFeed(feedId, feedData) {
  // no-op for now
  return;
}

function generateFeedId() {
  const name = Array(5);
  for (let i = 0; i < 5; i++) {
    const char = 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random()*26)];
    name[i] = char;
  }
  return name.join('');
}