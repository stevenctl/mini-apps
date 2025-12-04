## weidu (喂读)

Weidu is a lightweight RSS reader. Very lightweight.

## Platform

Web - plain HTML/CSS/JS, no frameworks. Uses web components for encapsulation.
Responsive layout for mobile and desktop.

## Features

### Feed Management
- Import feeds via URL with live preview
- Manage feeds (view, remove)
- Configurable refresh interval per feed (15min to 24hrs)
- Optional CORS proxy per feed for feeds that block cross-origin requests
- Supports RSS 2.0 and Atom feed formats

### Main Feed View
- Infinite scroll feed aggregating all subscribed feeds
- Articles sorted by date (newest first)
- Month separators in the feed
- Each article card shows:
  - Feed name (top left, small bold)
  - Date (top right)
  - Title
  - Author (if available)
  - Description preview (truncated)
- Cards link directly to original article (opens in new tab)

### Sidebar (desktop only)
- **Authors section**: Filter by feed/author with checkboxes
  - Select all / Deselect all toggle
  - None selected = show all (no filter)
- **Months section**: Scrollable list of months
  - Click to auto-scroll to that month in the feed

### Search
- Search box at the top
- Searches across title, description, author, and feed name
- Debounced input for smooth typing
- Combines with author filters

### Theme
- Light/dark mode toggle
- Respects system preference on first visit
- Persists preference to localStorage

### Data Storage
- All data stored in localStorage
- Feed list with metadata (URL, title, refresh interval, CORS setting)
- XML cache with timestamps for conditional refetching

## Architecture

### FeedProvider Abstraction
- `RSSFeedProvider`: Handles individual RSS/Atom feeds
- `AggregateFeedProvider`: Combines multiple feeds, sorted by date

### Storage Layer
- `storage.js`: localStorage wrapper for feeds and cache

### Components
- `feed-list.js`: Main feed web component with filtering and infinite scroll
- `modals.js`: Import and manage feeds modals
