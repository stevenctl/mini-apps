// Feed list web component with infinite scroll

import { AggregateFeedProvider } from '../feed-provider.js';
import { storage } from '../storage.js';

const BATCH_SIZE = 20;

class FeedList extends HTMLElement {
  constructor() {
    super();
    this.provider = new AggregateFeedProvider();
    this.articles = [];
    this.filteredArticles = [];
    this.displayedCount = 0;
    this.loading = false;
    this.selectedAuthors = new Set(); // empty = all selected
    this.searchQuery = '';
    this.showStarredOnly = false;
  }

  connectedCallback() {
    this.render();
    this.loadArticles();
    this.setupInfiniteScroll();
    this.setupSearch();

    // Listen for feed changes
    window.addEventListener('feeds-updated', () => this.loadArticles(true));
  }

  setupSearch() {
    const searchInput = document.getElementById('search-input');
    if (!searchInput) return;

    let debounceTimer;
    searchInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        this.searchQuery = searchInput.value.toLowerCase().trim();
        this.applyFilters();
        this.displayedCount = 0;
        this.loadMore();
      }, 200);
    });
  }

  disconnectedCallback() {
    if (this.scrollHandler) {
      window.removeEventListener('scroll', this.scrollHandler);
    }
  }

  setupInfiniteScroll() {
    this.scrollHandler = () => {
      if (this.loading) return;
      if (this.displayedCount >= this.filteredArticles.length) return;

      const scrollY = window.scrollY;
      const windowHeight = window.innerHeight;
      const docHeight = document.documentElement.scrollHeight;

      if (scrollY + windowHeight >= docHeight - 200) {
        this.loadMore();
      }
    };
    window.addEventListener('scroll', this.scrollHandler);
  }

  async loadArticles(forceRefresh = false) {
    this.loading = true;
    this.renderLoading();

    try {
      this.articles = await this.provider.fetchAllArticles(forceRefresh);
      this.applyFilters();
      this.displayedCount = 0;
      this.updateSidebar();
      this.loadMore();
    } catch (error) {
      console.error('Error loading articles:', error);
      this.renderError();
    }

    this.loading = false;
  }

  applyFilters() {
    const feeds = storage.getFeeds();
    const feedMap = {};
    feeds.forEach(f => feedMap[f.id] = f);

    this.filteredArticles = this.articles.filter(article => {
      // Author filter
      if (this.selectedAuthors.size > 0) {
        const feed = feedMap[article.feedId];
        const feedTitle = feed?.title || 'Unknown Feed';
        if (!this.selectedAuthors.has(feedTitle)) return false;
      }

      // Search filter
      if (this.searchQuery) {
        const title = (article.title || '').toLowerCase();
        const description = this.stripHtml(article.description || '').toLowerCase();
        const author = (article.author || '').toLowerCase();
        const feedTitle = (feedMap[article.feedId]?.title || '').toLowerCase();

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

      return true;
    });
  }

  loadMore() {
    const newCount = Math.min(this.displayedCount + BATCH_SIZE, this.filteredArticles.length);
    this.displayedCount = newCount;
    this.renderList();
  }

  render() {
    this.innerHTML = '<div class="feed-container"></div>';
  }

  renderLoading() {
    const container = this.querySelector('.feed-container');
    container.innerHTML = '<div class="loading">Loading feeds...</div>';
  }

  renderError() {
    const container = this.querySelector('.feed-container');
    container.innerHTML = `
      <div class="empty-state">
        <h3>Error loading feeds</h3>
        <p>Please check your connection and try again.</p>
      </div>
    `;
  }

  updateSidebar() {
    const feeds = storage.getFeeds();
    const feedMap = {};
    feeds.forEach(f => feedMap[f.id] = f);

    // Get unique authors (feed titles)
    const authors = new Set();
    this.articles.forEach(article => {
      const feed = feedMap[article.feedId];
      if (feed?.title) authors.add(feed.title);
    });

    // Get unique months
    const months = new Map();
    this.articles.forEach(article => {
      if (article.pubDate) {
        const date = new Date(article.pubDate);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (!months.has(key)) {
          months.set(key, {
            key,
            label: date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
          });
        }
      }
    });

    // Render starred filter
    const starredFilter = document.getElementById('starred-filter');
    if (starredFilter) {
      starredFilter.checked = this.showStarredOnly;
      starredFilter.onchange = () => {
        this.showStarredOnly = starredFilter.checked;
        this.applyFilters();
        this.displayedCount = 0;
        this.loadMore();
      };
    }

    // Render author filters
    const authorContainer = document.getElementById('author-filters');
    if (authorContainer) {
      const sortedAuthors = [...authors].sort();
      authorContainer.innerHTML = sortedAuthors.map(author => {
        const checked = this.selectedAuthors.size === 0 || this.selectedAuthors.has(author);
        return `
          <label class="author-filter">
            <input type="checkbox" value="${this.escapeHtml(author)}" ${checked ? 'checked' : ''}>
            ${this.escapeHtml(author)}
          </label>
        `;
      }).join('');

      authorContainer.querySelectorAll('input').forEach(input => {
        input.addEventListener('change', () => this.handleAuthorFilter(input));
      });

      // Setup toggle all button
      const toggleBtn = document.getElementById('toggle-authors');
      if (toggleBtn) {
        this.updateToggleButton();
        toggleBtn.onclick = () => this.toggleAllAuthors();
      }
    }

    // Render month navigation
    const monthContainer = document.getElementById('month-nav');
    if (monthContainer) {
      const sortedMonths = [...months.values()].sort((a, b) => b.key.localeCompare(a.key));
      monthContainer.innerHTML = sortedMonths.map(month => `
        <div class="month-link" data-month="${month.key}">${month.label}</div>
      `).join('');

      monthContainer.querySelectorAll('.month-link').forEach(link => {
        link.addEventListener('click', () => this.scrollToMonth(link.dataset.month));
      });
    }
  }

  handleAuthorFilter(input) {
    const allCheckboxes = document.querySelectorAll('#author-filters input');
    const checkedCount = [...allCheckboxes].filter(cb => cb.checked).length;

    if (checkedCount === 0 || checkedCount === allCheckboxes.length) {
      // None or all checked = no filter (show all)
      this.selectedAuthors.clear();
    } else {
      // Build set of checked authors
      this.selectedAuthors.clear();
      allCheckboxes.forEach(cb => {
        if (cb.checked) this.selectedAuthors.add(cb.value);
      });
    }

    this.updateToggleButton();
    this.applyFilters();
    this.displayedCount = 0;
    this.loadMore();
  }

  updateToggleButton() {
    const toggleBtn = document.getElementById('toggle-authors');
    const allCheckboxes = document.querySelectorAll('#author-filters input');
    if (!toggleBtn || allCheckboxes.length === 0) return;

    const anyChecked = [...allCheckboxes].some(cb => cb.checked);
    toggleBtn.textContent = anyChecked ? 'Deselect all' : 'Select all';
  }

  toggleAllAuthors() {
    const allCheckboxes = document.querySelectorAll('#author-filters input');
    const anyChecked = [...allCheckboxes].some(cb => cb.checked);

    // Toggle: if any checked, uncheck all; if none checked, check all
    allCheckboxes.forEach(cb => {
      cb.checked = !anyChecked;
    });
    this.selectedAuthors.clear();

    this.updateToggleButton();
    this.applyFilters();
    this.displayedCount = 0;
    this.loadMore();
  }

  scrollToMonth(monthKey) {
    const target = this.querySelector(`[data-month="${monthKey}"]`);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      // Month not yet loaded, load all and scroll
      this.displayedCount = this.filteredArticles.length;
      this.renderList();
      setTimeout(() => {
        const target = this.querySelector(`[data-month="${monthKey}"]`);
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
    }

    // Update active state
    document.querySelectorAll('.month-link').forEach(link => {
      link.classList.toggle('active', link.dataset.month === monthKey);
    });
  }

  getMonthKey(dateStr) {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  renderList() {
    const container = this.querySelector('.feed-container');
    const feeds = storage.getFeeds();

    if (feeds.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>No feeds yet</h3>
          <p>Click "Import Feed" to add your first RSS feed.</p>
        </div>
      `;
      return;
    }

    if (this.filteredArticles.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>No articles</h3>
          <p>No articles match your filters.</p>
        </div>
      `;
      return;
    }

    const feedMap = {};
    feeds.forEach(f => feedMap[f.id] = f);

    const displayed = this.filteredArticles.slice(0, this.displayedCount);
    let currentMonth = null;
    let html = '';

    displayed.forEach(article => {
      const feed = feedMap[article.feedId];
      const feedTitle = feed?.title || 'Unknown Feed';
      const date = article.pubDate ? new Date(article.pubDate).toLocaleDateString() : '';
      const description = this.stripHtml(article.description).slice(0, 200);
      const monthKey = this.getMonthKey(article.pubDate);

      // Add month separator if new month
      if (monthKey && monthKey !== currentMonth) {
        const monthDate = new Date(article.pubDate);
        const monthLabel = monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        html += `<div class="month-separator" data-month="${monthKey}">${monthLabel}</div>`;
        currentMonth = monthKey;
      }

      const isStarred = storage.isStarred(article.id);

      html += `
        <div class="feed-item-wrapper">
          <a class="feed-item" href="${this.escapeHtml(article.link)}" target="_blank" rel="noopener">
            <div class="feed-item-header">
              <span class="feed-item-feed">${this.escapeHtml(feedTitle)}</span>
              ${date ? `<span class="feed-item-date">${date}</span>` : ''}
            </div>
            <div class="feed-item-title">${this.escapeHtml(article.title)}</div>
            ${article.author ? `<div class="feed-item-meta">${this.escapeHtml(article.author)}</div>` : ''}
            ${description ? `<div class="feed-item-description">${this.escapeHtml(description)}</div>` : ''}
          </a>
          <button class="star-btn ${isStarred ? 'starred' : ''}" data-id="${article.id}" title="${isStarred ? 'Unstar' : 'Star'}">
            ${isStarred ? '★' : '☆'}
          </button>
        </div>
      `;
    });

    container.innerHTML = html;

    // Add star button handlers
    container.querySelectorAll('.star-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const articleId = btn.dataset.id;
        const nowStarred = storage.toggleStar(articleId);
        btn.classList.toggle('starred', nowStarred);
        btn.textContent = nowStarred ? '★' : '☆';
        btn.title = nowStarred ? 'Unstar' : 'Star';

        // If showing starred only and we unstarred, re-filter
        if (this.showStarredOnly && !nowStarred) {
          this.applyFilters();
          this.displayedCount = 0;
          this.loadMore();
        }
      });
    });

    // Show loading indicator if more items available
    if (this.displayedCount < this.filteredArticles.length) {
      container.insertAdjacentHTML('beforeend', '<div class="loading">Loading more...</div>');
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  stripHtml(html) {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
  }
}

customElements.define('feed-list', FeedList);
