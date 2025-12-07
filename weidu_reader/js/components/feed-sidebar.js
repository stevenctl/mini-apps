// Sidebar component - handles author filters, month navigation, starred filter

import { storage } from '../storage.js';

class FeedSidebar extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.selectedAuthors = new Set();
    this.showStarredOnly = false;
    this.showUnreadOnly = false;
    this.authors = [];
    this.months = [];

    // Bound handlers for cleanup
    this._onAuthorClick = this._handleAuthorClick.bind(this);
    this._onMonthClick = this._handleMonthClick.bind(this);
    this._onStarredChange = this._handleStarredChange.bind(this);
    this._onUnreadChange = this._handleUnreadChange.bind(this);
    this._onToggleClick = this._handleToggleAll.bind(this);
  }

  connectedCallback() {
    this._render();
    this._attachListeners();
  }

  disconnectedCallback() {
    this._detachListeners();
  }

  _attachListeners() {
    const root = this.shadowRoot;
    root.getElementById('author-filters')?.addEventListener('click', this._onAuthorClick);
    root.getElementById('month-nav')?.addEventListener('click', this._onMonthClick);
    root.getElementById('starred-filter')?.addEventListener('change', this._onStarredChange);
    root.getElementById('unread-filter')?.addEventListener('change', this._onUnreadChange);
    root.getElementById('toggle-authors')?.addEventListener('click', this._onToggleClick);
  }

  _detachListeners() {
    const root = this.shadowRoot;
    root.getElementById('author-filters')?.removeEventListener('click', this._onAuthorClick);
    root.getElementById('month-nav')?.removeEventListener('click', this._onMonthClick);
    root.getElementById('starred-filter')?.removeEventListener('change', this._onStarredChange);
    root.getElementById('unread-filter')?.removeEventListener('change', this._onUnreadChange);
    root.getElementById('toggle-authors')?.removeEventListener('click', this._onToggleClick);
  }

  // Called by parent to update sidebar data
  setArticles(articles, feeds) {
    const feedMap = new Map(feeds.map(f => [f.id, f]));

    // Extract unique authors
    const authorSet = new Set();
    articles.forEach(article => {
      const feed = feedMap.get(article.feedId);
      if (feed?.title) authorSet.add(feed.title);
    });
    this.authors = [...authorSet].sort();

    // Extract unique months
    const monthMap = new Map();
    articles.forEach(article => {
      if (article.pubDate) {
        const date = new Date(article.pubDate);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (!monthMap.has(key)) {
          monthMap.set(key, {
            key,
            label: date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
          });
        }
      }
    });
    this.months = [...monthMap.values()].sort((a, b) => b.key.localeCompare(a.key));

    this._renderFilters();
  }

  getFilters() {
    return {
      selectedAuthors: this.selectedAuthors,
      showStarredOnly: this.showStarredOnly,
      showUnreadOnly: this.showUnreadOnly,
    };
  }

  _handleAuthorClick(e) {
    const checkbox = e.target.closest('input[type="checkbox"]');
    if (!checkbox) return;

    const allCheckboxes = this.shadowRoot.querySelectorAll('#author-filters input[type="checkbox"]');
    const checkedCount = [...allCheckboxes].filter(cb => cb.checked).length;

    if (checkedCount === 0 || checkedCount === allCheckboxes.length) {
      this.selectedAuthors.clear();
    } else {
      this.selectedAuthors.clear();
      allCheckboxes.forEach(cb => {
        if (cb.checked) this.selectedAuthors.add(cb.value);
      });
    }

    this._updateToggleButton();
    this._emitFilterChange();
  }

  _handleMonthClick(e) {
    const monthLink = e.target.closest('.month-link');
    if (!monthLink) return;

    const monthKey = monthLink.dataset.month;

    // Update active state
    this.shadowRoot.querySelectorAll('.month-link').forEach(link => {
      link.classList.toggle('active', link.dataset.month === monthKey);
    });

    this.dispatchEvent(new CustomEvent('month-navigate', {
      bubbles: true,
      detail: { monthKey }
    }));
  }

  _handleStarredChange(e) {
    this.showStarredOnly = e.target.checked;
    this._emitFilterChange();
  }

  _handleUnreadChange(e) {
    this.showUnreadOnly = e.target.checked;
    this._emitFilterChange();
  }

  _handleToggleAll() {
    const allCheckboxes = this.shadowRoot.querySelectorAll('#author-filters input[type="checkbox"]');
    const anyChecked = [...allCheckboxes].some(cb => cb.checked);

    allCheckboxes.forEach(cb => {
      cb.checked = !anyChecked;
    });
    this.selectedAuthors.clear();

    this._updateToggleButton();
    this._emitFilterChange();
  }

  _updateToggleButton() {
    const toggleBtn = this.shadowRoot.getElementById('toggle-authors');
    const allCheckboxes = this.shadowRoot.querySelectorAll('#author-filters input[type="checkbox"]');
    if (!toggleBtn || allCheckboxes.length === 0) return;

    const anyChecked = [...allCheckboxes].some(cb => cb.checked);
    toggleBtn.textContent = anyChecked ? 'Deselect all' : 'Select all';
  }

  _emitFilterChange() {
    this.dispatchEvent(new CustomEvent('filter-change', {
      bubbles: true,
      detail: this.getFilters()
    }));
  }

  _render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }
        .sidebar-section {
          margin-bottom: 1.5rem;
        }
        .sidebar-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.5rem;
        }
        h3 {
          margin: 0 0 0.5rem 0;
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--color-text-secondary, #666);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .sidebar-header h3 {
          margin: 0;
        }
        .btn-link {
          background: none;
          border: none;
          color: var(--color-primary, #0066cc);
          cursor: pointer;
          font-size: 0.75rem;
          padding: 0;
        }
        .btn-link:hover {
          text-decoration: underline;
        }
        .author-filter {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.25rem 0;
          cursor: pointer;
          font-size: 0.875rem;
        }
        .author-filter input {
          cursor: pointer;
        }
        .month-nav {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          max-height: 300px;
          overflow-y: auto;
          scrollbar-width: thin;
          scrollbar-color: var(--color-border, #e0e0e0) transparent;
        }
        .month-nav::-webkit-scrollbar {
          width: 12px;
        }
        .month-nav::-webkit-scrollbar-track {
          background: transparent;
        }
        .month-nav::-webkit-scrollbar-thumb {
          background: var(--color-border, #e0e0e0);
          border-radius: 6px;
        }
        .month-nav::-webkit-scrollbar-thumb:hover {
          background: var(--color-text-secondary, #666);
        }
        .month-link {
          padding: 0.375rem 0.5rem;
          border-radius: var(--radius, 4px);
          cursor: pointer;
          font-size: 0.875rem;
          color: var(--color-text, #333);
          transition: background-color 0.15s;
        }
        .month-link:hover {
          background: var(--color-bg-hover, #f0f0f0);
        }
        .month-link.active {
          background: var(--color-primary, #0066cc);
          color: white;
        }
      </style>
      <div class="sidebar-section">
        <label class="author-filter">
          <input type="checkbox" id="starred-filter">
          <span>&#9733; Starred only</span>
        </label>
        <label class="author-filter">
          <input type="checkbox" id="unread-filter">
          <span>Unread only</span>
        </label>
      </div>
      <div class="sidebar-section">
        <div class="sidebar-header">
          <h3>Authors</h3>
          <button id="toggle-authors" class="btn-link">Deselect all</button>
        </div>
        <div id="author-filters"></div>
      </div>
      <div class="sidebar-section">
        <h3>Months</h3>
        <div id="month-nav" class="month-nav"></div>
      </div>
    `;
  }

  _renderFilters() {
    // Render author checkboxes
    const authorContainer = this.shadowRoot.getElementById('author-filters');
    if (authorContainer) {
      authorContainer.innerHTML = this.authors.map(author => {
        const checked = this.selectedAuthors.size === 0 || this.selectedAuthors.has(author);
        return `
          <label class="author-filter">
            <input type="checkbox" value="${this._escapeHtml(author)}" ${checked ? 'checked' : ''}>
            <span>${this._escapeHtml(author)}</span>
          </label>
        `;
      }).join('');
    }

    // Render month links
    const monthContainer = this.shadowRoot.getElementById('month-nav');
    if (monthContainer) {
      monthContainer.innerHTML = this.months.map(month => `
        <div class="month-link" data-month="${month.key}">${month.label}</div>
      `).join('');
    }

    this._updateToggleButton();
  }

  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

customElements.define('feed-sidebar', FeedSidebar);
