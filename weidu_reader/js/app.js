// Main app entry point

import './components/feed-list.js';
import './components/feed-sidebar.js';
import './components/feed-search.js';
import { showImportFeedModal, showManageFeedsModal } from './components/modals.js';

// Wire up header buttons
document.getElementById('import-feed-btn').addEventListener('click', showImportFeedModal);
document.getElementById('manage-feeds-btn').addEventListener('click', showManageFeedsModal);

// Wire up sidebar to receive article data from feed-list
const sidebar = document.querySelector('feed-sidebar');
window.addEventListener('articles-loaded', (e) => {
  const { articles, feeds } = e.detail;
  sidebar?.setArticles(articles, feeds);
});

// Theme toggle
const themeToggle = document.getElementById('theme-toggle');
const THEME_KEY = 'weidu_theme';

function setTheme(dark) {
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  themeToggle.textContent = dark ? '\u2600\uFE0F' : '\uD83C\uDF19';
  localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light');
}

// Initialize theme
const savedTheme = localStorage.getItem(THEME_KEY);
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
const isDark = savedTheme ? savedTheme === 'dark' : prefersDark;
setTheme(isDark);

themeToggle.addEventListener('click', () => {
  const currentlyDark = document.documentElement.getAttribute('data-theme') === 'dark';
  setTheme(!currentlyDark);
});
