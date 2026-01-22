# API Usage Scraper - Multi-Platform

This directory contains the multi-platform implementation of the API Usage Scraper.

## Directory Structure

```
platforms/
├── shared/                 # Shared code across all platforms
│   ├── scrapers/          # Platform-agnostic scraping logic
│   ├── lib/               # Utility libraries
│   └── ui/                # Shared UI components (future)
├── firefox/               # Firefox extension (copied from browser-extension/)
├── chrome/                # Chrome extension (Manifest v3)
├── safari/                # Safari extension structure
├── mobile/                # Capacitor mobile app
└── build.js               # Multi-platform build script
```

## Building

### Build All Platforms

```bash
cd platforms
node build.js all
```

This creates:
- `dist-platforms/firefox/` - Firefox extension
- `dist-platforms/chrome/` - Chrome extension
- `dist-platforms/safari/` - Safari extension (requires Xcode wrapper)

### Build Specific Platform

```bash
node build.js firefox
node build.js chrome
node build.js safari
```

## Platform Details

### Firefox Extension

The Firefox extension is the primary development target. It uses:
- Manifest v2
- `browser.*` API namespace
- WebExtensions standard

**Installation:**
1. Open Firefox
2. Navigate to `about:debugging#/runtime/this-firefox`
3. Click "Load Temporary Add-on"
4. Select `dist-platforms/firefox/manifest.json`

### Chrome Extension

Chrome extension uses Manifest v3 with:
- `chrome.*` API namespace
- Service worker background script
- `action` API instead of `browserAction`

**Installation:**
1. Open Chrome
2. Navigate to `chrome://extensions`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select `dist-platforms/chrome/` directory

### Safari Extension

Safari extensions require an Xcode wrapper app:

1. Build the Safari extension files: `node build.js safari`
2. Open Xcode
3. Create new Safari Web Extension project
4. Copy contents from `dist-platforms/safari/API Usage Scraper Extension/Resources/`
5. Build and run from Xcode

**Requirements:**
- macOS 11.0+
- Xcode 12.0+
- Apple Developer account (for distribution)

### Mobile App (Capacitor)

The mobile app uses Capacitor for iOS and Android with:
- In-app browser for navigating to provider pages
- JavaScript injection for scraping
- Native storage for data persistence

**Setup:**

```bash
cd platforms/mobile
npm install
npm run build
npx cap add ios      # For iOS
npx cap add android  # For Android
```

**Run on iOS:**
```bash
npm run ios
```

**Run on Android:**
```bash
npm run android
```

## API Differences

| Feature | Firefox | Chrome | Safari | Mobile |
|---------|---------|--------|--------|--------|
| API Namespace | `browser.*` | `chrome.*` | `browser.*` | Capacitor |
| Manifest | v2 | v3 | v2 | N/A |
| Background | Script | Service Worker | Script | N/A |
| Storage | `browser.storage` | `chrome.storage` | `browser.storage` | Preferences |
| Scraping | Content Scripts | Content Scripts | Content Scripts | WebView Injection |

## Shared Code

The `shared/` directory contains platform-agnostic code:

### `shared/scrapers/`
Core scraping logic that can be used across all platforms. Each scraper exports:
- `PROVIDER_ID` - Unique identifier
- `PROVIDER_NAME` - Display name
- `scrapeFunction(document)` - Pure function that extracts data

### `shared/lib/providers.js`
Provider configuration and helper functions.

### `shared/lib/storage.js`
Storage abstraction layer with adapters for each platform.

### `shared/lib/utils.js`
Utility functions (time formatting, currency formatting, etc.)

## Development Workflow

1. **Primary development** happens in `browser-extension/` (Firefox)
2. Run `node build.js all` to generate all platform builds
3. Test on each platform
4. For platform-specific changes, edit files in `platforms/{platform}/`

## Notes

- Chrome Manifest v3 has limitations with persistent background scripts
- Safari requires app bundling through Xcode
- Mobile app cannot use traditional content scripts; uses WebView JS injection instead
- User authentication cookies are preserved in the embedded browser on mobile
