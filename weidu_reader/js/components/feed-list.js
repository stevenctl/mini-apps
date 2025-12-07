// Feed list web component with infinite scroll and incremental rendering

import { AggregateFeedProvider } from '../feed-provider.js';
import { storage } from '../storage.js';
import './feed-item.js';

const BATCH_SIZE = 20;

class FeedList extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.provider = new AggregateFeedProvider();
    this.articles = [];
    this.filteredArticles = [];
    this.displayedCount = 0;
    this.loading = false;
    this.selectedAuthors = new Set();
    this.searchQuery = '';
    this.showStarredOnly = false;
    this.showUnreadOnly = false;

    // Track rendered items for incremental updates
    this._renderedIds = new Set();

    // Bound handlers for cleanup
    this._onScroll = this._handleScroll.bind(this);
    this._onFilterChange = this._handleFilterChange.bind(this);
    this._onSearchChange = this._handleSearchChange.bind(this);
    this._onMonthNavigate = this._handleMonthNavigate.bind(this);
    this._onFeedsUpdated = () => this.loadArticles(true);
    this._onStarToggle = this._handleStarToggle.bind(this);
    this._onReadToggle = this._handleReadToggle.bind(this);
  }

  connectedCallback() {
    this._render();
    this._attachListeners();
    this.loadArticles();
  }

  disconnectedCallback() {
    this._detachListeners();
  }

  _attachListeners() {
    window.addEventListener('scroll', this._onScroll);
    window.addEventListener('feeds-updated', this._onFeedsUpdated);
    window.addEventListener('filter-change', this._onFilterChange);
    window.addEventListener('search-change', this._onSearchChange);
    window.addEventListener('month-navigate', this._onMonthNavigate);

    // Listen for star/read toggle events from feed-item components
    this.shadowRoot.addEventListener('star-toggle', this._onStarToggle);
    this.shadowRoot.addEventListener('read-toggle', this._onReadToggle);
  }

  _detachListeners() {
    window.removeEventListener('scroll', this._onScroll);
    window.removeEventListener('feeds-updated', this._onFeedsUpdated);
    window.removeEventListener('filter-change', this._onFilterChange);
    window.removeEventListener('search-change', this._onSearchChange);
    window.removeEventListener('month-navigate', this._onMonthNavigate);

    this.shadowRoot.removeEventListener('star-toggle', this._onStarToggle);
    this.shadowRoot.removeEventListener('read-toggle', this._onReadToggle);
  }

  _handleScroll() {
    if (this.loading) return;
    if (this.displayedCount >= this.filteredArticles.length) return;

    const scrollY = window.scrollY;
    const windowHeight = window.innerHeight;
    const docHeight = document.documentElement.scrollHeight;

    if (scrollY + windowHeight >= docHeight - 200) {
      this.loadMore();
    }
  }

  _handleFilterChange(e) {
    const { selectedAuthors, showStarredOnly, showUnreadOnly } = e.detail;
    this.selectedAuthors = new Set(selectedAuthors); // Copy to avoid shared reference
    this.showStarredOnly = showStarredOnly;
    this.showUnreadOnly = showUnreadOnly;
    this._applyFiltersAndReset();
  }

  _handleSearchChange(e) {
    this.searchQuery = e.detail.query;
    this._applyFiltersAndReset();
  }

  _handleMonthNavigate(e) {
    const { monthKey } = e.detail;
    const target = this.shadowRoot.querySelector(`[data-month="${monthKey}"]`);

    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      // Month not yet loaded, render all and scroll
      this.displayedCount = this.filteredArticles.length;
      this._renderList();
      setTimeout(() => {
        const target = this.shadowRoot.querySelector(`[data-month="${monthKey}"]`);
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
    }
  }

  _handleStarToggle(e) {
    const { articleId, starred } = e.detail;

    // If showing starred only and we unstarred, re-filter
    if (this.showStarredOnly && !starred) {
      this._applyFiltersAndReset();
    }
  }

  _handleReadToggle(e) {
    const { articleId, read } = e.detail;

    // If showing unread only and we marked as read, re-filter
    if (this.showUnreadOnly && read) {
      this._applyFiltersAndReset();
    }
  }

  _applyFiltersAndReset() {
    this._applyFilters();
    this.displayedCount = 0;
    this._renderedIds.clear();
    this.loadMore();
  }

  async loadArticles(forceRefresh = false) {
    this.loading = true;
    this._renderLoading();

    try {
      this.articles = await this.provider.fetchAllArticles(forceRefresh);
      this._applyFilters();
      this.displayedCount = 0;
      this._renderedIds.clear();

      // Notify sidebar of new data
      this._notifySidebar();

      this.loadMore();
    } catch (error) {
      console.error('Error loading articles:', error);
      this._renderError();
    }

    this.loading = false;
  }

  _notifySidebar() {
    const feeds = storage.getFeeds();
    this.dispatchEvent(new CustomEvent('articles-loaded', {
      bubbles: true,
      detail: { articles: this.articles, feeds }
    }));
  }

  _applyFilters() {
    const feeds = storage.getFeeds();
    const feedMap = new Map(feeds.map(f => [f.id, f]));

    this.filteredArticles = this.articles.filter(article => {
      // Author filter
      if (this.selectedAuthors.size > 0) {
        const feed = feedMap.get(article.feedId);
        const feedTitle = feed?.title || 'Unknown Feed';
        if (!this.selectedAuthors.has(feedTitle)) return false;
      }

      // Search filter
      if (this.searchQuery) {
        const title = (article.title || '').toLowerCase();
        const description = this._stripHtml(article.description || '').toLowerCase();
        const author = (article.author || '').toLowerCase();
        const feedTitle = (feedMap.get(article.feedId)?.title || '').toLowerCase();

        if (!title.includes(this.searchQuery) &&
            !description.includes(this.searchQuery) &&
            !author.includes(this.searchQuery) &&
            !feedTitle.includes(this.searchQuery)) {
          return false;
        }
      }

      // Starred filter
      if (this.showStarredOnly && !storage.isStarred(article.id)) {
        return false;
      }

      // Unread filter
      if (this.showUnreadOnly && storage.isRead(article.id)) {
        return false;
      }

      return true;
    });
  }

  loadMore() {
    const newCount = Math.min(this.displayedCount + BATCH_SIZE, this.filteredArticles.length);
    this.displayedCount = newCount;
    this._renderList();
  }

  _render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }
        .feed-container {
          column-count: 3;
          column-gap: 1rem;
        }
        .feed-container > * {
          break-inside: avoid;
          margin-bottom: 1rem;
        }
        .loading {
          column-span: all;
          padding: 2rem;
          text-align: center;
          color: var(--color-text-secondary, #666);
        }
        .empty-state {
          column-span: all;
          padding: 3rem;
          text-align: center;
          color: var(--color-text-secondary, #666);
        }
        .empty-state h3 {
          margin: 0 0 0.5rem 0;
          color: var(--color-text, #333);
        }
        .empty-state p {
          margin: 0;
        }
        .month-separator {
          column-span: all;
          text-align: center;
          padding: 2rem 0 1rem;
          font-weight: 600;
          font-size: 1rem;
          color: var(--color-text-secondary, #666);
        }

        @media (max-width: 900px) {
          .feed-container {
            column-count: 2;
          }
        }

        @media (max-width: 640px) {
          .feed-container {
            column-count: 1;
          }
        }
      </style>
      <div class="feed-container"></div>
    `;
  }

  _renderLoading() {
    const container = this.shadowRoot.querySelector('.feed-container');
    container.innerHTML = '<div class="loading">Loading feeds...</div>';
    this._renderedIds.clear();
  }

  _renderError() {
    const container = this.shadowRoot.querySelector('.feed-container');
    container.innerHTML = `
      <div class="empty-state">
        <h3>Error loading feeds</h3>
        <p>Please check your connection and try again.</p>
      </div>
    `;
    this._renderedIds.clear();
  }

  _renderList() {
    const container = this.shadowRoot.querySelector('.feed-container');
    const feeds = storage.getFeeds();

    if (feeds.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>No feeds yet</h3>
          <p>Click "Import Feed" to add your first RSS feed.</p>
        </div>
      `;
      this._renderedIds.clear();
      return;
    }

    if (this.filteredArticles.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>No articles</h3>
          <p>No articles match your filters.</p>
        </div>
      `;
      this._renderedIds.clear();
      return;
    }

    const feedMap = new Map(feeds.map(f => [f.id, f]));
    const displayed = this.filteredArticles.slice(0, this.displayedCount);

    // If starting fresh, clear container
    if (this._renderedIds.size === 0) {
      container.innerHTML = '';
    }

    // Remove loading indicator if present
    const loadingEl = container.querySelector('.loading');
    if (loadingEl) loadingEl.remove();

    let currentMonth = null;

    // Find last rendered month
    const monthSeparators = container.querySelectorAll('.month-separator');
    if (monthSeparators.length > 0) {
      currentMonth = monthSeparators[monthSeparators.length - 1].dataset.month;
    }

    // Append only new items
    const fragment = document.createDocumentFragment();

    for (const article of displayed) {
      if (this._renderedIds.has(article.id)) continue;

      const monthKey = this._getMonthKey(article.pubDate);

      // Add month separator if new month
      if (monthKey && monthKey !== currentMonth) {
        const monthDate = new Date(article.pubDate);
        const monthLabel = monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

        const separator = document.createElement('div');
        separator.className = 'month-separator';
        separator.dataset.month = monthKey;
        separator.textContent = monthLabel;
        fragment.appendChild(separator);

        currentMonth = monthKey;
      }

      const feed = feedMap.get(article.feedId);
      const feedTitle = feed?.title || 'Unknown Feed';

      const feedItem = document.createElement('feed-item');
      feedItem.article = article;
      feedItem.feedTitle = feedTitle;
      fragment.appendChild(feedItem);

      this._renderedIds.add(article.id);
    }

    container.appendChild(fragment);

    // Show loading indicator if more items available
    if (this.displayedCount < this.filteredArticles.length) {
      const loading = document.createElement('div');
      loading.className = 'loading';
      loading.textContent = 'Loading more...';
      container.appendChild(loading);
    }
  }

  _getMonthKey(dateStr) {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  _stripHtml(html) {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
  }
}

customElements.define('feed-list', FeedList);
