// Local storage wrapper for feeds and cached XML data

const FEEDS_KEY = 'weidu_feeds';
const CACHE_KEY = 'weidu_cache';
const STARRED_KEY = 'weidu_starred';

export const storage = {
  // Feed management
  getFeeds() {
    const data = localStorage.getItem(FEEDS_KEY);
    return data ? JSON.parse(data) : [];
  },

  saveFeed(feed) {
    const feeds = this.getFeeds();
    const existing = feeds.findIndex(f => f.url === feed.url);
    if (existing >= 0) {
      feeds[existing] = { ...feeds[existing], ...feed };
    } else {
      feeds.push({
        id: crypto.randomUUID(),
        url: feed.url,
        title: feed.title || feed.url,
        refreshInterval: feed.refreshInterval || 60, // minutes
        useCorsProxy: feed.useCorsProxy || false,
        addedAt: Date.now(),
      });
    }
    localStorage.setItem(FEEDS_KEY, JSON.stringify(feeds));
    return feeds;
  },

  removeFeed(feedId) {
    const feeds = this.getFeeds().filter(f => f.id !== feedId);
    localStorage.setItem(FEEDS_KEY, JSON.stringify(feeds));
    // Also remove cached data
    this.clearCache(feedId);
    return feeds;
  },

  // XML Cache management
  getCache(feedId) {
    const cache = this.getAllCache();
    return cache[feedId] || null;
  },

  setCache(feedId, xmlText, articles) {
    const cache = this.getAllCache();
    cache[feedId] = {
      xml: xmlText,
      articles: articles,
      cachedAt: Date.now(),
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  },

  clearCache(feedId) {
    const cache = this.getAllCache();
    delete cache[feedId];
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  },

  getAllCache() {
    const data = localStorage.getItem(CACHE_KEY);
    return data ? JSON.parse(data) : {};
  },

  isCacheValid(feedId, refreshIntervalMinutes) {
    const cache = this.getCache(feedId);
    if (!cache) return false;
    const age = Date.now() - cache.cachedAt;
    const maxAge = refreshIntervalMinutes * 60 * 1000;
    return age < maxAge;
  },

  // Starred articles
  getStarred() {
    const data = localStorage.getItem(STARRED_KEY);
    return data ? JSON.parse(data) : [];
  },

  isStarred(articleId) {
    return this.getStarred().includes(articleId);
  },

  toggleStar(articleId) {
    const starred = this.getStarred();
    const index = starred.indexOf(articleId);
    if (index >= 0) {
      starred.splice(index, 1);
    } else {
      starred.push(articleId);
    }
    localStorage.setItem(STARRED_KEY, JSON.stringify(starred));
    return index < 0; // returns true if now starred
  },
};
