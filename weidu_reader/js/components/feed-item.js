// Feed item card component

import { storage } from '../storage.js';
import { placehlderUrls, placeholderColors } from './placeholders.js';

class FeedItem extends HTMLElement {
  static get observedAttributes() {
    return ['article-id'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._article = null;
    this._feedTitle = '';
    this._onStarClick = this._handleStarClick.bind(this);
    this._onReadClick = this._handleReadClick.bind(this);
  }

  connectedCallback() {
    this._render();
    this.shadowRoot.querySelector('.star-btn')?.addEventListener('click', this._onStarClick);
    this.shadowRoot.querySelector('.read-btn')?.addEventListener('click', this._onReadClick);
  }

  disconnectedCallback() {
    this.shadowRoot.querySelector('.star-btn')?.removeEventListener('click', this._onStarClick);
    this.shadowRoot.querySelector('.read-btn')?.removeEventListener('click', this._onReadClick);
  }

  set article(data) {
    this._article = data;
    this._render();
  }

  get article() {
    return this._article;
  }

  set feedTitle(title) {
    this._feedTitle = title;
    this._render();
  }

  _handleStarClick(e) {
    e.preventDefault();
    e.stopPropagation();

    if (!this._article) return;

    const nowStarred = storage.toggleStar(this._article.id);
    const btn = this.shadowRoot.querySelector('.star-btn');
    btn.classList.toggle('starred', nowStarred);
    btn.textContent = nowStarred ? '\u2605' : '\u2606';
    btn.title = nowStarred ? 'Unstar' : 'Star';

    this.dispatchEvent(new CustomEvent('star-toggle', {
      bubbles: true,
      detail: { articleId: this._article.id, starred: nowStarred }
    }));
  }

  _handleReadClick(e) {
    e.preventDefault();
    e.stopPropagation();

    if (!this._article) return;

    const nowRead = storage.toggleRead(this._article.id);
    const btn = this.shadowRoot.querySelector('.read-btn');
    btn.classList.toggle('read', nowRead);
    btn.textContent = '\u2713';
    btn.title = nowRead ? 'Mark unread' : 'Mark read';

    this.classList.toggle('is-read', nowRead);

    this.dispatchEvent(new CustomEvent('read-toggle', {
      bubbles: true,
      detail: { articleId: this._article.id, read: nowRead }
    }));
  }

  _getAuthorImage() {
    if (!this._article) return null;

    const { enclosure, mediaContent, image } = this._article;

    let imageUrl = null;

    // Check explicit image field from feed
    if (image) {
      imageUrl = image;
    }
    // Check enclosure (common for podcasts/media)
    else if (enclosure?.url && enclosure.type?.startsWith('image/')) {
      imageUrl = enclosure.url;
    }
    // Check media:content
    else if (mediaContent?.url) {
      imageUrl = mediaContent.url;
    }
    // Try to parse image from description HTML
    else {
      const { description } = this._article;
      if (description) {
        const imgMatch = description.match(/<img[^>]+src=["']([^"']+)["']/i);
        if (imgMatch) imageUrl = imgMatch[1];
      }
    }

    // Resolve relative URLs using article link
    if (imageUrl && !imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
      imageUrl = this._resolveUrl(imageUrl, this._article.link);
    }

    return imageUrl;
  }

  _resolveUrl(relativeUrl, baseUrl) {
    if (!baseUrl) return relativeUrl;
    try {
      const base = new URL(baseUrl);
      return new URL(relativeUrl, base.origin).href;
    } catch {
      return relativeUrl;
    }
  }

  _hashString(str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
    }
    return hash;
  }

  _getFallbackImage(str) {
    const hash = this._hashString(str);
    const index = Math.abs(hash) % placehlderUrls.length;
    return placehlderUrls[index];
  }

  _getPlaceholderColor(str) {
    // Check for custom color first
    const customColor = storage.getFeedColor(this._article?.feedId);
    if (customColor) return customColor;

    // Fall back to deterministic color
    const hash = this._hashString(str + 'color');
    const index = Math.abs(hash) % placeholderColors.length;
    return placeholderColors[index];
  }

  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }

  _stripHtml(html) {
    const div = document.createElement('div');
    div.innerHTML = html || '';
    return div.textContent || div.innerText || '';
  }

  _render() {
    if (!this._article) {
      this.shadowRoot.innerHTML = '';
      return;
    }

    const { title, link, description, pubDate } = this._article;
    const date = pubDate ? new Date(pubDate).toLocaleDateString() : '';
    const desc = this._stripHtml(description);
    const isStarred = storage.isStarred(this._article.id);
    const isRead = storage.isRead(this._article.id);

    const authorImage = this._getAuthorImage();
    const articleKey = this._article.link || this._article.id;
    const placeholderImage = this._getFallbackImage(articleKey);
    const placeholderColor = this._getPlaceholderColor(this._feedTitle || this._article.feedId);
    const hasRealImage = !!authorImage;
    const imageUrl = authorImage || placeholderImage;

    // Random height variation +/- 10%
    const hash = this._hashString((this._article.link || this._article.id) + 'height');
    const variation = 0.9 + (Math.abs(hash) % 21) / 100; // 0.9 to 1.1
    const descMaxHeight = (8.4 * variation).toFixed(1);

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }
        .card {
          position: relative;
          border-radius: var(--radius, 8px);
          overflow: hidden;
          background: var(--color-surface, #fff);
          border: 1px solid var(--color-border, #e0e0e0);
          transition: box-shadow 0.15s, transform 0.15s;
        }
        .card:hover {
          box-shadow: var(--shadow-md, 0 4px 6px rgba(0,0,0,0.1));
          transform: translateY(-2px);
        }
        .card-link {
          display: block;
          text-decoration: none;
          color: inherit;
        }
        .card-image {
          width: 100%;
          aspect-ratio: 3 / 1;
          background-size: cover;
          background-position: center;
          background-color: var(--color-bg, #f8f8f8);
        }
        .card-image.real-image {
          aspect-ratio: 2 / 1;
        }
        .card-content {
          padding: 0.75rem;
        }
        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.75rem;
          color: var(--color-text-secondary, #666);
          margin-bottom: 0.25rem;
        }
        .card-feed {
          font-weight: 600;
          color: var(--color-primary, #0066cc);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 60%;
        }
        .card-title {
          font-weight: 600;
          font-size: 0.875rem;
          line-height: 1.3;
          color: var(--color-text, #333);
          margin-bottom: 0.25rem;
        }
        .card-desc {
          font-size: 0.75rem;
          color: var(--color-text-secondary, #666);
          line-height: 1.4;
          max-height: ${descMaxHeight}em;
          overflow: hidden;
          -webkit-mask-image: linear-gradient(to bottom, black 60%, transparent 100%);
          mask-image: linear-gradient(to bottom, black 60%, transparent 100%);
        }
        .card-actions {
          position: absolute;
          top: 0.5rem;
          right: 0.5rem;
          display: flex;
          gap: 0.25rem;
        }
        .star-btn, .read-btn {
          background: var(--color-surface, #fff);
          border: none;
          border-radius: 50%;
          width: 2rem;
          height: 2rem;
          font-size: 1rem;
          cursor: pointer;
          color: var(--color-text-secondary, #999);
          transition: color 0.15s, transform 0.15s;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: var(--shadow-sm, 0 1px 2px rgba(0,0,0,0.1));
        }
        .star-btn:hover, .read-btn:hover {
          transform: scale(1.1);
        }
        .star-btn:hover {
          color: var(--color-warning, #f5a623);
        }
        .star-btn.starred {
          color: var(--color-warning, #f5a623);
        }
        .read-btn:hover {
          color: var(--color-primary, #2563eb);
        }
        .read-btn.read {
          color: var(--color-primary, #2563eb);
        }
        :host(.is-read) .card {
          opacity: 0.6;
        }
      </style>
      <article class="card">
        <a class="card-link" href="${this._escapeHtml(link)}" target="_blank" rel="noopener">
          <div class="card-image ${hasRealImage ? 'real-image' : ''}" style="background-image: url('${this._escapeHtml(imageUrl)}');${hasRealImage ? '' : ` background-color: ${placeholderColor}`}"></div>
          <div class="card-content">
            <div class="card-header">
              <span class="card-feed" style="color: ${placeholderColor}">${this._escapeHtml(this._feedTitle)}</span>
              <span class="card-date">${date}</span>
            </div>
            <div class="card-title">${this._escapeHtml(title)}</div>
            ${desc ? `<div class="card-desc">${this._escapeHtml(desc)}</div>` : ''}
          </div>
        </a>
        <div class="card-actions">
          <button class="read-btn ${isRead ? 'read' : ''}" title="${isRead ? 'Mark unread' : 'Mark read'}">\u2713</button>
          <button class="star-btn ${isStarred ? 'starred' : ''}" title="${isStarred ? 'Unstar' : 'Star'}">${isStarred ? '\u2605' : '\u2606'}</button>
        </div>
      </article>
    `;

    // Set read state on host
    this.classList.toggle('is-read', isRead);

    // Re-attach listeners after render
    this.shadowRoot.querySelector('.star-btn')?.addEventListener('click', this._onStarClick);
    this.shadowRoot.querySelector('.read-btn')?.addEventListener('click', this._onReadClick);
  }
}

customElements.define('feed-item', FeedItem);
