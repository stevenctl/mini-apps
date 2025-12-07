// FeedProvider abstraction for RSS/Atom feeds

import { storage } from './storage.js';

// Parse RSS 2.0 feed
function parseRSS(xml, feedId, feedUrl) {
  const items = xml.querySelectorAll('item');
  return Array.from(items).map(item => {
    // Try to find image from various sources
    let image = null;

    // Check enclosure
    const enclosure = item.querySelector('enclosure');
    if (enclosure?.getAttribute('type')?.startsWith('image/')) {
      image = enclosure.getAttribute('url');
    }

    // Check media:content or media:thumbnail
    if (!image) {
      const mediaContent = item.querySelector('content, thumbnail');
      if (mediaContent?.getAttribute('url')) {
        image = mediaContent.getAttribute('url');
      }
    }

    // Check itunes:image
    if (!image) {
      const itunesImage = item.querySelector('image');
      if (itunesImage?.getAttribute('href')) {
        image = itunesImage.getAttribute('href');
      }
    }

    return {
      id: item.querySelector('guid')?.textContent || item.querySelector('link')?.textContent || crypto.randomUUID(),
      feedId,
      feedUrl,
      title: item.querySelector('title')?.textContent || 'Untitled',
      link: item.querySelector('link')?.textContent || '',
      description: item.querySelector('description')?.textContent || '',
      pubDate: parseDate(item.querySelector('pubDate')?.textContent),
      author: item.querySelector('author')?.textContent || item.querySelector('dc\\:creator')?.textContent || '',
      image,
    };
  });
}

// Parse Atom feed
function parseAtom(xml, feedId, feedUrl) {
  const entries = xml.querySelectorAll('entry');
  return Array.from(entries).map(entry => {
    const link = entry.querySelector('link[rel="alternate"]') || entry.querySelector('link');

    // Try to find image
    let image = null;

    // Check link with rel="enclosure" and image type
    const enclosureLink = entry.querySelector('link[rel="enclosure"]');
    if (enclosureLink?.getAttribute('type')?.startsWith('image/')) {
      image = enclosureLink.getAttribute('href');
    }

    // Check media:content or media:thumbnail
    if (!image) {
      const mediaContent = entry.querySelector('content[medium="image"], thumbnail');
      if (mediaContent?.getAttribute('url')) {
        image = mediaContent.getAttribute('url');
      }
    }

    return {
      id: entry.querySelector('id')?.textContent || crypto.randomUUID(),
      feedId,
      feedUrl,
      title: entry.querySelector('title')?.textContent || 'Untitled',
      link: link?.getAttribute('href') || '',
      description: entry.querySelector('summary')?.textContent || entry.querySelector('content')?.textContent || '',
      pubDate: parseDate(entry.querySelector('published')?.textContent || entry.querySelector('updated')?.textContent),
      author: entry.querySelector('author name')?.textContent || '',
      image,
    };
  });
}

function parseDate(dateStr) {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date.toISOString();
}

function detectFeedType(xml) {
  if (xml.querySelector('rss') || xml.querySelector('channel > item')) {
    return 'rss';
  }
  if (xml.querySelector('feed') || xml.documentElement.tagName.toLowerCase() === 'feed') {
    return 'atom';
  }
  return 'unknown';
}

function getFeedTitle(xml, type) {
  if (type === 'rss') {
    return xml.querySelector('channel > title')?.textContent || '';
  }
  if (type === 'atom') {
    return xml.querySelector('feed > title')?.textContent || '';
  }
  return '';
}

const CORS_PROXY = 'https://cors-anywhere.com/';

// Single feed provider
export class RSSFeedProvider {
  constructor(feed) {
    this.feed = feed;
  }

  async fetchArticles(forceRefresh = false) {
    const { id, url, refreshInterval, useCorsProxy } = this.feed;
    const fetchUrl = useCorsProxy ? CORS_PROXY + url : url;

    // Check cache first
    if (!forceRefresh && storage.isCacheValid(id, refreshInterval)) {
      const cache = storage.getCache(id);
      return cache.articles;
    }

    // Fetch fresh data
    try {
      const response = await fetch(fetchUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const xmlText = await response.text();
      const parser = new DOMParser();
      const xml = parser.parseFromString(xmlText, 'text/xml');

      const parseError = xml.querySelector('parsererror');
      if (parseError) throw new Error('Invalid XML');

      const type = detectFeedType(xml);
      let articles;

      if (type === 'rss') {
        articles = parseRSS(xml, id, url);
      } else if (type === 'atom') {
        articles = parseAtom(xml, id, url);
      } else {
        throw new Error('Unknown feed format');
      }

      // Update feed title if we got one
      const feedTitle = getFeedTitle(xml, type);
      if (feedTitle && feedTitle !== this.feed.title) {
        storage.saveFeed({ ...this.feed, title: feedTitle });
      }

      // Cache the results
      storage.setCache(id, xmlText, articles);

      return articles;
    } catch (error) {
      console.error(`Error fetching feed ${url}:`, error);
      // Return cached data if available, even if stale
      const cache = storage.getCache(id);
      if (cache) return cache.articles;
      throw error;
    }
  }
}

// Aggregate feed provider - combines multiple feeds
export class AggregateFeedProvider {
  constructor() {
    this.providers = [];
  }

  loadFeeds() {
    const feeds = storage.getFeeds();
    this.providers = feeds.map(feed => new RSSFeedProvider(feed));
  }

  async fetchAllArticles(forceRefresh = false) {
    this.loadFeeds();

    if (this.providers.length === 0) {
      return [];
    }

    const results = await Promise.allSettled(
      this.providers.map(p => p.fetchArticles(forceRefresh))
    );

    const allArticles = [];
    for (const result of results) {
      if (result.status === 'fulfilled') {
        allArticles.push(...result.value);
      }
    }

    // Sort by date, newest first
    allArticles.sort((a, b) => {
      if (!a.pubDate) return 1;
      if (!b.pubDate) return -1;
      return new Date(b.pubDate) - new Date(a.pubDate);
    });

    return allArticles;
  }
}

// Utility to validate and preview a feed URL
export async function previewFeed(url, useCorsProxy = false) {
  const fetchUrl = useCorsProxy ? CORS_PROXY + url : url;
  const response = await fetch(fetchUrl);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const xmlText = await response.text();
  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlText, 'text/xml');

  const parseError = xml.querySelector('parsererror');
  if (parseError) throw new Error('Invalid XML feed');

  const type = detectFeedType(xml);
  if (type === 'unknown') throw new Error('Not a valid RSS or Atom feed');

  const title = getFeedTitle(xml, type);

  return { title, type, url };
}
