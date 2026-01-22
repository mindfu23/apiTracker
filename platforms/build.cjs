#!/usr/bin/env node

/**
 * Multi-Platform Build Script for API Usage Scraper
 *
 * Builds the extension/app for different platforms:
 * - firefox: Firefox extension (Manifest v2, browser.* API)
 * - chrome: Chrome extension (Manifest v3, chrome.* API)
 * - safari: Safari extension (requires Xcode wrapper)
 * - mobile: Capacitor mobile app
 *
 * Usage:
 *   node build.js [platform]
 *   node build.js all
 *   node build.js firefox
 *   node build.js chrome
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname);
const FIREFOX_SRC = path.join(ROOT, '..', 'browser-extension');
const DIST = path.join(ROOT, '..', 'dist-platforms');

// Platform-specific configurations
const PLATFORMS = {
  firefox: {
    outDir: 'firefox',
    apiNamespace: 'browser',
    manifestVersion: 2,
    description: 'Firefox extension using browser.* API'
  },
  chrome: {
    outDir: 'chrome',
    apiNamespace: 'chrome',
    manifestVersion: 3,
    description: 'Chrome extension using chrome.* API (Manifest v3)'
  },
  safari: {
    outDir: 'safari',
    apiNamespace: 'browser', // Safari uses browser.* with polyfill
    manifestVersion: 2,
    description: 'Safari extension (requires Xcode wrapper)'
  }
};

/**
 * Transform browser.* to chrome.* API calls
 */
function transformToChrome(content) {
  return content
    .replace(/browser\.runtime/g, 'chrome.runtime')
    .replace(/browser\.tabs/g, 'chrome.tabs')
    .replace(/browser\.storage/g, 'chrome.storage')
    .replace(/browser\.browserAction/g, 'chrome.action');
}

/**
 * Copy file with optional transformation
 */
function copyFile(src, dest, transform = null) {
  let content = fs.readFileSync(src, 'utf8');
  if (transform) {
    content = transform(content);
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, content);
  console.log(`  Copied: ${path.basename(src)} -> ${path.relative(ROOT, dest)}`);
}

/**
 * Copy directory recursively with transformation
 */
function copyDir(srcDir, destDir, transform = null) {
  if (!fs.existsSync(srcDir)) return;

  fs.mkdirSync(destDir, { recursive: true });
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath, transform);
    } else if (entry.name.endsWith('.js')) {
      copyFile(srcPath, destPath, transform);
    } else {
      copyFile(srcPath, destPath);
    }
  }
}

/**
 * Build Firefox extension (copy from source)
 */
function buildFirefox() {
  console.log('\n📦 Building Firefox extension...');
  const outDir = path.join(DIST, 'firefox');

  // Copy all files from browser-extension (it's already Firefox-compatible)
  copyDir(FIREFOX_SRC, outDir);

  console.log('✅ Firefox build complete');
  return outDir;
}

/**
 * Build Chrome extension (Manifest v3)
 */
function buildChrome() {
  console.log('\n📦 Building Chrome extension...');
  const outDir = path.join(DIST, 'chrome');
  const chromeTemplate = path.join(ROOT, 'chrome');

  // Copy Chrome-specific files first
  if (fs.existsSync(chromeTemplate)) {
    copyDir(chromeTemplate, outDir);
  }

  // Copy and transform scrapers from Firefox
  copyDir(
    path.join(FIREFOX_SRC, 'scrapers'),
    path.join(outDir, 'scrapers'),
    transformToChrome
  );

  // Copy and transform popup.js
  copyFile(
    path.join(FIREFOX_SRC, 'popup.js'),
    path.join(outDir, 'popup.js'),
    transformToChrome
  );

  // Copy popup.html (no transformation needed)
  copyFile(
    path.join(FIREFOX_SRC, 'popup.html'),
    path.join(outDir, 'popup.html')
  );

  // Copy and transform dashboard.js
  copyFile(
    path.join(FIREFOX_SRC, 'dashboard.js'),
    path.join(outDir, 'dashboard.js'),
    transformToChrome
  );

  // Copy dashboard.html
  copyFile(
    path.join(FIREFOX_SRC, 'dashboard.html'),
    path.join(outDir, 'dashboard.html')
  );

  // Copy icons
  copyDir(
    path.join(FIREFOX_SRC, 'icons'),
    path.join(outDir, 'icons')
  );

  console.log('✅ Chrome build complete');
  return outDir;
}

/**
 * Build Safari extension wrapper structure
 */
function buildSafari() {
  console.log('\n📦 Building Safari extension structure...');
  const outDir = path.join(DIST, 'safari');
  const extensionDir = path.join(outDir, 'API Usage Scraper Extension', 'Resources');

  // Copy Firefox extension as base (Safari uses browser.* API)
  copyDir(FIREFOX_SRC, extensionDir);

  // Create Safari-specific manifest (same as Firefox but with Safari adjustments)
  const firefoxManifest = JSON.parse(
    fs.readFileSync(path.join(FIREFOX_SRC, 'manifest.json'), 'utf8')
  );

  // Safari manifest adjustments
  const safariManifest = {
    ...firefoxManifest,
    // Safari-specific keys would go here
    // Most settings are handled by Xcode project
  };

  fs.writeFileSync(
    path.join(extensionDir, 'manifest.json'),
    JSON.stringify(safariManifest, null, 2)
  );

  // Create Xcode project placeholder info
  fs.writeFileSync(
    path.join(outDir, 'README.md'),
    `# Safari Extension

This directory contains the Safari extension resources.

## Building for Safari

1. Open Xcode
2. Create new Safari Web Extension project:
   - File > New > Project
   - Choose "Safari Extension App"
3. Copy the contents of "API Usage Scraper Extension/Resources"
   into your Xcode project's Resources folder
4. Build and run in Xcode

## Requirements
- macOS 11.0 or later
- Xcode 12.0 or later
- Apple Developer account (for distribution)

## Notes
- Safari uses the browser.* API like Firefox
- The extension must be bundled with a macOS/iOS app
`
  );

  console.log('✅ Safari build complete (requires Xcode project wrapper)');
  return outDir;
}

/**
 * Main build function
 */
function build(platform = 'all') {
  console.log('🔧 API Usage Scraper - Multi-Platform Build');
  console.log('==========================================');

  // Clean dist directory
  if (fs.existsSync(DIST)) {
    fs.rmSync(DIST, { recursive: true });
  }
  fs.mkdirSync(DIST, { recursive: true });

  const results = {};

  if (platform === 'all' || platform === 'firefox') {
    results.firefox = buildFirefox();
  }

  if (platform === 'all' || platform === 'chrome') {
    results.chrome = buildChrome();
  }

  if (platform === 'all' || platform === 'safari') {
    results.safari = buildSafari();
  }

  console.log('\n==========================================');
  console.log('📁 Build outputs:');
  for (const [name, dir] of Object.entries(results)) {
    console.log(`   ${name}: ${path.relative(ROOT, dir)}`);
  }
  console.log('\n✨ Build complete!');

  return results;
}

// Run if called directly
if (require.main === module) {
  const platform = process.argv[2] || 'all';
  build(platform);
}

module.exports = { build, PLATFORMS };
