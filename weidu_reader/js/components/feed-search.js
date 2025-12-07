// Search component - handles search input with debouncing

class FeedSearch extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._debounceTimer = null;
    this._onInput = this._handleInput.bind(this);
  }

  connectedCallback() {
    this._render();
    this.shadowRoot.getElementById('search-input')?.addEventListener('input', this._onInput);
  }

  disconnectedCallback() {
    clearTimeout(this._debounceTimer);
    this.shadowRoot.getElementById('search-input')?.removeEventListener('input', this._onInput);
  }

  _handleInput(e) {
    clearTimeout(this._debounceTimer);
    this._debounceTimer = setTimeout(() => {
      const query = e.target.value.toLowerCase().trim();
      this.dispatchEvent(new CustomEvent('search-change', {
        bubbles: true,
        detail: { query }
      }));
    }, 200);
  }

  clear() {
    const input = this.shadowRoot.getElementById('search-input');
    if (input) input.value = '';
  }

  _render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }
        .search-bar {
          max-width: 1200px;
          margin: 0 auto;
          padding: 1rem;
          padding-bottom: 0;
        }
        input {
          width: 100%;
          padding: 0.625rem 1rem;
          border: 1px solid var(--color-border, #e0e0e0);
          border-radius: var(--radius, 4px);
          font-size: 0.875rem;
          background: var(--color-bg, #f8f8f8);
          color: var(--color-text, #333);
          box-sizing: border-box;
        }
        input:focus {
          outline: none;
          border-color: var(--color-primary, #0066cc);
          box-shadow: 0 0 0 2px var(--color-primary-alpha, rgba(0, 102, 204, 0.2));
        }
        input::placeholder {
          color: var(--color-text-secondary, #666);
        }
      </style>
      <div class="search-bar">
        <input type="search" id="search-input" placeholder="Search articles...">
      </div>
    `;
  }
}

customElements.define('feed-search', FeedSearch);
