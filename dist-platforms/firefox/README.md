# API Usage Scraper - Browser Extension

A Firefox/Chrome extension that scrapes usage data from AI provider dashboards and displays it in a unified view.

## Supported Providers

| Provider | Dashboard URL | Data Scraped |
|----------|--------------|--------------|
| Anthropic | console.anthropic.com/settings/usage | Spending, balance, limits, usage % |
| Claude.ai | claude.ai/settings | Session/weekly usage, extra usage, limits |
| OpenAI | platform.openai.com/usage | Spend, budget, tokens, requests |
| GitHub Copilot | github.com/settings/billing/premium_requests_usage | Premium requests, model breakdown, billed amount |
| Google Cloud | console.cloud.google.com | Credits used/remaining, expiration |
| Perplexity | perplexity.ai/settings/api | Credit balance, usage tier, requests |

## Installation

### Firefox

1. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on..."
3. Select the `manifest.json` file from this directory

### Chrome/Edge

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select this directory

**Note:** For Chrome, you may need to change `browser.*` to `chrome.*` in the JS files, or use a polyfill.

## Usage

1. **Install the extension** using the steps above
2. **Log into your provider dashboards** (Anthropic, OpenAI, etc.)
3. **Navigate to the usage/billing page** of a provider
4. **Click the extension icon** in your browser toolbar
5. **Click "Scrape Current Page"** to collect the data
6. **Repeat** for other providers
7. **Click "View Collected Data"** to see the unified dashboard

## How It Works

The extension uses **content scripts** that run on provider dashboard pages. When you click "Scrape", the content script:

1. Reads the visible page content (DOM + text)
2. Uses regex patterns to extract usage data
3. Stores the data in browser local storage
4. No credentials are stored or transmitted

### Data Privacy

- **No login credentials stored** - uses your existing browser sessions
- **Data stays local** - stored in browser's local storage only
- **No external requests** - no data sent to any server
- **You control the data** - export or clear anytime

## Creating Icons

The extension needs icons at 16x16, 48x48, and 128x128 pixels. Create them as:

```
icons/
  icon-16.png
  icon-48.png
  icon-128.png
```

Simple approach: Create a 128x128 PNG with "API" text, then resize.

## Customizing Scrapers

Each provider has its own scraper in `scrapers/`. The scrapers use:

1. **DOM queries** - Look for specific elements by class/id
2. **Text patterns** - Regex on page text for amounts, percentages
3. **Fallback strategies** - Multiple patterns for resilience

To add a new provider:

1. Create `scrapers/new-provider.js`
2. Add content script entry in `manifest.json`
3. Add provider config in `popup.js` and `dashboard.js`

## Exporting Data

Click "Export JSON" in the dashboard to download all collected data. Format:

```json
{
  "exportedAt": "2026-01-22T...",
  "providers": {
    "anthropic": {
      "creditBalance": 8.58,
      "amountSpent": 41.91,
      "monthlyLimit": 40,
      "lastScraped": "2026-01-22T..."
    },
    "openai": { ... },
    ...
  }
}
```

## Integrating with API Tracker

To send data to your API Tracker app:

1. Export the JSON from the extension
2. Import it in API Tracker settings (future feature)

Or modify `popup.js` to POST directly to your API Tracker endpoint.

## Troubleshooting

### "No data found" when scraping

- Make sure you're on the correct page (e.g., `/settings/usage`, not `/settings`)
- Some pages load data dynamically - wait a few seconds before scraping
- Check browser console for errors

### Extension not appearing

- Ensure the manifest.json has no syntax errors
- Reload the extension after any changes
- Check permissions in manifest match the URLs you're visiting

### Data not persisting

- Browser storage has limits (~5MB for local storage)
- Private/incognito mode may not persist data
- Check if storage permissions are granted

## Development

To modify the extension:

1. Edit files in this directory
2. In Firefox: Click "Reload" in `about:debugging`
3. In Chrome: Click the refresh icon on the extension card

Check browser console (F12) for any JavaScript errors.
