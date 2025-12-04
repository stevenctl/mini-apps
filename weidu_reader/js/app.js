// Main app entry point

import './components/feed-list.js';
import { showImportFeedModal, showManageFeedsModal } from './components/modals.js';

// Wire up header buttons
document.getElementById('import-feed-btn').addEventListener('click', showImportFeedModal);
document.getElementById('manage-feeds-btn').addEventListener('click', showManageFeedsModal);

// Theme toggle
const themeToggle = document.getElementById('theme-toggle');
const THEME_KEY = 'weidu_theme';

function setTheme(dark) {
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  themeToggle.textContent = dark ? '☀️' : '🌙';
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
