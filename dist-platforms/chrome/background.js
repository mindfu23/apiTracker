/**
 * API Usage Scraper - Chrome Background Service Worker (Manifest v3)
 * Handles message passing, storage management, and background scraping
 */

// Provider configurations
const PROVIDERS = [
  { id: 'anthropic', urls: ['platform.claude.com', 'console.anthropic.com'], dashboardUrl: 'https://platform.claude.com/usage' },
  { id: 'openai', urls: ['platform.openai.com'], dashboardUrl: 'https://platform.openai.com/usage' },
  { id: 'claude-ai', urls: ['claude.ai/settings'], dashboardUrl: 'https://claude.ai/settings/usage' },
  { id: 'github-copilot', urls: ['github.com/settings/billing'], dashboardUrl: 'https://github.com/settings/billing/premium_requests_usage' },
  { id: 'google-cloud', urls: ['console.cloud.google.com'], dashboardUrl: 'https://console.cloud.google.com/billing' },
  { id: 'perplexity', urls: ['perplexity.ai/account', 'perplexity.ai/settings'], dashboardUrl: 'https://www.perplexity.ai/account/api/billing' }
];

// Storage key
const STORAGE_KEY = 'api_usage_data';

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'saveData') {
    saveScrapedData(message.provider, message.data)
      .then(() => sendResponse({ success: true }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.action === 'getData') {
    getStoredData()
      .then(data => sendResponse({ success: true, data }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.action === 'refreshAll') {
    refreshAllProviders()
      .then(() => sendResponse({ success: true }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.action === 'scrapeTab') {
    scrapeTab(message.tabId)
      .then(result => sendResponse(result))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.action === 'scrapeTabWhenReady') {
    scrapeTabWhenReady(message.tabId, message.providerId)
      .then(result => sendResponse(result))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

// Refresh all providers by finding matching open tabs
async function refreshAllProviders() {
  const tabs = await chrome.tabs.query({});
  const scrapedProviders = new Set();

  for (const tab of tabs) {
    if (!tab.url) continue;

    for (const provider of PROVIDERS) {
      if (scrapedProviders.has(provider.id)) continue;

      const matches = provider.urls.some(url => tab.url.includes(url));
      if (matches) {
        try {
          const result = await chrome.tabs.sendMessage(tab.id, { action: 'scrape' });
          if (result && result.success) {
            await saveScrapedData(result.provider, result.data);
            scrapedProviders.add(provider.id);
          }
        } catch (e) {
          console.log(`Could not scrape tab ${tab.id}: ${e.message}`);
        }
      }
    }
  }

  return { scrapedCount: scrapedProviders.size };
}

// Scrape a specific tab
async function scrapeTab(tabId) {
  try {
    const result = await chrome.tabs.sendMessage(tabId, { action: 'scrape' });
    if (result && result.success) {
      await saveScrapedData(result.provider, result.data);
    }
    return result;
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// Scrape a tab once it finishes loading
async function scrapeTabWhenReady(tabId, providerId) {
  return new Promise((resolve) => {
    const listener = async (updatedTabId, changeInfo, tab) => {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);

        // Wait for content script to initialize
        setTimeout(async () => {
          try {
            const result = await chrome.tabs.sendMessage(tabId, { action: 'scrape' });
            if (result && result.success) {
              await saveScrapedData(result.provider || providerId, result.data);
              resolve({ success: true });
            } else {
              resolve({ success: false, error: result?.error || 'Scrape failed' });
            }
          } catch (e) {
            console.log(`Auto-scrape failed for tab ${tabId}: ${e.message}`);
            resolve({ success: false, error: e.message });
          }
        }, 1500);
      }
    };

    chrome.tabs.onUpdated.addListener(listener);

    // Timeout after 30 seconds
    setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve({ success: false, error: 'Timeout waiting for page load' });
    }, 30000);
  });
}

// Storage helpers
async function getStoredData() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return result[STORAGE_KEY] || {};
}

async function saveScrapedData(providerId, data) {
  const existing = await getStoredData();
  existing[providerId] = {
    ...data,
    lastScraped: new Date().toISOString()
  };
  await chrome.storage.local.set({ [STORAGE_KEY]: existing });
}

// Badge update on data change
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[STORAGE_KEY]) {
    const data = changes[STORAGE_KEY].newValue || {};
    const count = Object.keys(data).length;
    chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' });
    chrome.action.setBadgeBackgroundColor({ color: '#10b981' });
  }
});
