// Modal components for feed management

import { storage } from '../storage.js';
import { previewFeed } from '../feed-provider.js';
import { placeholderColors } from './placeholders.js';

function getDefaultColor(feedTitle) {
  const str = feedTitle + 'color'; // Must match feed-item.js _getPlaceholderColor
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
  }
  const index = Math.abs(hash) % placeholderColors.length;
  return placeholderColors[index];
}

export function showModal(content) {
  const container = document.getElementById('modal-container');
  container.innerHTML = `
    <div class="modal-backdrop">
      <div class="modal">
        ${content}
      </div>
    </div>
  `;

  // Close on backdrop click
  container.querySelector('.modal-backdrop').addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-backdrop')) {
      closeModal();
    }
  });

  // Close on escape
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      closeModal();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
}

export function closeModal() {
  document.getElementById('modal-container').innerHTML = '';
}

export function showImportFeedModal() {
  showModal(`
    <div class="modal-header">
      <h2>Import Feed</h2>
      <button class="modal-close">&times;</button>
    </div>
    <div class="modal-body">
      <form id="import-feed-form">
        <div class="form-group">
          <label for="feed-url">Feed URL</label>
          <input type="url" id="feed-url" placeholder="https://example.com/feed.xml" required>
        </div>
        <div class="form-group">
          <label for="refresh-interval">Refresh Interval (minutes)</label>
          <select id="refresh-interval">
            <option value="15">15 minutes</option>
            <option value="30">30 minutes</option>
            <option value="60" selected>1 hour</option>
            <option value="360">6 hours</option>
            <option value="1440">24 hours</option>
          </select>
        </div>
        <div class="form-group">
          <label class="checkbox-label">
            <input type="checkbox" id="use-cors-proxy">
            cors-anywhere.com
          </label>
        </div>
        <div id="feed-preview" style="display: none; margin-top: 1rem; padding: 0.75rem; background: var(--color-bg); border-radius: var(--radius);"></div>
        <div id="import-error" style="display: none; margin-top: 1rem; color: var(--color-danger); font-size: 0.875rem;"></div>
        <div class="form-actions">
          <button type="button" class="btn" id="cancel-import">Cancel</button>
          <button type="submit" class="btn btn-primary" id="submit-import">Add Feed</button>
        </div>
      </form>
    </div>
  `);

  const form = document.getElementById('import-feed-form');
  const urlInput = document.getElementById('feed-url');
  const preview = document.getElementById('feed-preview');
  const error = document.getElementById('import-error');
  const submitBtn = document.getElementById('submit-import');

  document.querySelector('.modal-close').addEventListener('click', closeModal);
  document.getElementById('cancel-import').addEventListener('click', closeModal);

  const corsCheckbox = document.getElementById('use-cors-proxy');

  // Preview feed on URL change (debounced)
  let previewTimeout;
  const tryPreview = () => {
    clearTimeout(previewTimeout);
    preview.style.display = 'none';
    error.style.display = 'none';

    if (!urlInput.value) return;

    previewTimeout = setTimeout(async () => {
      try {
        const result = await previewFeed(urlInput.value, corsCheckbox.checked);
        preview.innerHTML = `<strong>${result.title || 'Untitled Feed'}</strong><br><small>${result.type.toUpperCase()} feed</small>`;
        preview.style.display = 'block';
      } catch (err) {
        error.textContent = err.message;
        error.style.display = 'block';
      }
    }, 500);
  };

  urlInput.addEventListener('input', tryPreview);
  corsCheckbox.addEventListener('change', tryPreview);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    error.style.display = 'none';
    submitBtn.disabled = true;
    submitBtn.textContent = 'Adding...';

    try {
      const useCorsProxy = document.getElementById('use-cors-proxy').checked;
      const result = await previewFeed(urlInput.value, useCorsProxy);
      storage.saveFeed({
        url: urlInput.value,
        title: result.title,
        refreshInterval: parseInt(document.getElementById('refresh-interval').value),
        useCorsProxy,
      });
      closeModal();
      window.dispatchEvent(new CustomEvent('feeds-updated'));
    } catch (err) {
      error.textContent = `Failed to add feed: ${err.message}`;
      error.style.display = 'block';
      submitBtn.disabled = false;
      submitBtn.textContent = 'Add Feed';
    }
  });
}

export function showManageFeedsModal() {
  const feeds = storage.getFeeds();

  const feedsHtml = feeds.length === 0
    ? '<p style="color: var(--color-text-secondary);">No feeds added yet.</p>'
    : feeds.map(feed => {
        const defaultColor = getDefaultColor(feed.title);
        const currentColor = feed.customColor || defaultColor;
        return `
        <div class="manage-feed-item" data-id="${feed.id}">
          <div class="manage-feed-color">
            <button class="color-swatch-btn" data-id="${feed.id}" style="background-color: ${currentColor}" title="Change color"></button>
            <div class="color-palette" data-id="${feed.id}">
              ${placeholderColors.map(color => `
                <button class="palette-color ${color === currentColor ? 'selected' : ''}" data-color="${color}" data-feed-id="${feed.id}" style="background-color: ${color}"></button>
              `).join('')}
            </div>
          </div>
          <div class="manage-feed-info">
            <div class="manage-feed-title">${escapeHtml(feed.title)}</div>
            <div class="manage-feed-url">${escapeHtml(feed.url)}</div>
            <label class="checkbox-label" style="margin-top: 0.25rem;">
              <input type="checkbox" class="cors-toggle" data-id="${feed.id}" ${feed.useCorsProxy ? 'checked' : ''}>
              cors-anywhere.com
            </label>
          </div>
          <div class="manage-feed-actions">
            <button class="btn btn-danger btn-remove" data-id="${feed.id}">Remove</button>
          </div>
        </div>
      `}).join('');

  showModal(`
    <div class="modal-header">
      <h2>Manage Feeds</h2>
      <button class="modal-close">&times;</button>
    </div>
    <div class="modal-body">
      <div id="feeds-list">
        ${feedsHtml}
      </div>
      <div class="form-actions" style="margin-top: 1rem;">
        <button class="btn" id="close-manage">Close</button>
      </div>
    </div>
  `);

  document.querySelector('.modal-close').addEventListener('click', closeModal);
  document.getElementById('close-manage').addEventListener('click', closeModal);

  // Handle remove buttons
  document.querySelectorAll('.btn-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const feedId = btn.dataset.id;
      if (confirm('Remove this feed?')) {
        storage.removeFeed(feedId);
        window.dispatchEvent(new CustomEvent('feeds-updated'));
        showManageFeedsModal(); // Refresh the modal
      }
    });
  });

  // Handle CORS proxy toggles
  document.querySelectorAll('.cors-toggle').forEach(toggle => {
    toggle.addEventListener('change', () => {
      const feedId = toggle.dataset.id;
      const feed = feeds.find(f => f.id === feedId);
      if (feed) {
        storage.saveFeed({ ...feed, useCorsProxy: toggle.checked });
        storage.clearCache(feedId); // Clear cache to refetch with new setting
        window.dispatchEvent(new CustomEvent('feeds-updated'));
      }
    });
  });

  // Handle color swatch button clicks (toggle palette)
  document.querySelectorAll('.color-swatch-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const feedId = btn.dataset.id;
      // Close all other palettes
      document.querySelectorAll('.color-palette').forEach(p => {
        if (p.dataset.id !== feedId) p.classList.remove('open');
      });
      // Toggle this palette
      const palette = document.querySelector(`.color-palette[data-id="${feedId}"]`);
      palette.classList.toggle('open');
    });
  });

  // Handle palette color selection
  document.querySelectorAll('.palette-color').forEach(colorBtn => {
    colorBtn.addEventListener('click', () => {
      const feedId = colorBtn.dataset.feedId;
      const color = colorBtn.dataset.color;
      const feed = feeds.find(f => f.id === feedId);
      if (feed) {
        storage.saveFeed({ ...feed, customColor: color });
        window.dispatchEvent(new CustomEvent('feeds-updated'));
        showManageFeedsModal(); // Refresh modal
      }
    });
  });

  // Close palette when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.manage-feed-color')) {
      document.querySelectorAll('.color-palette').forEach(p => p.classList.remove('open'));
    }
  }, { once: true });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
