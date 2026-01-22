/**
 * API Usage Scraper - Background Script
 * Handles message passing and storage management
 */

// Listen for messages from content scripts
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'saveData') {
    saveScrapedData(message.provider, message.data)
      .then(() => sendResponse({ success: true }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true; // Keep channel open for async response
  }

  if (message.action === 'getData') {
    getStoredData()
      .then(data => sendResponse({ success: true, data }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

// Storage helpers
const STORAGE_KEY = 'api_usage_data';

async function getStoredData() {
  const result = await browser.storage.local.get(STORAGE_KEY);
  return result[STORAGE_KEY] || {};
}

async function saveScrapedData(providerId, data) {
  const existing = await getStoredData();
  existing[providerId] = {
    ...data,
    lastScraped: new Date().toISOString()
  };
  await browser.storage.local.set({ [STORAGE_KEY]: existing });
}

// Badge update on data change
browser.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[STORAGE_KEY]) {
    const data = changes[STORAGE_KEY].newValue || {};
    const count = Object.keys(data).length;
    browser.browserAction.setBadgeText({ text: count > 0 ? String(count) : '' });
    browser.browserAction.setBadgeBackgroundColor({ color: '#10b981' });
  }
});
