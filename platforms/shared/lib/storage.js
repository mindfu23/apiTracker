/**
 * Storage Abstraction Layer - Shared across platforms
 * Provides a unified interface for storage that works with:
 * - Browser extension storage (browser.storage.local / chrome.storage.local)
 * - Capacitor Preferences
 * - localStorage (fallback)
 */

const STORAGE_KEY = 'api_usage_data';
const CUSTOM_PAGES_KEY = 'custom_scrape_pages';
const LAST_REFRESH_KEY = 'last_dashboard_refresh';

/**
 * Storage adapter interface
 * Implement this for each platform
 */
class StorageAdapter {
  async get(key) { throw new Error('Not implemented'); }
  async set(key, value) { throw new Error('Not implemented'); }
  async remove(key) { throw new Error('Not implemented'); }
}

/**
 * Browser Extension Storage Adapter (Firefox/Chrome/Safari)
 */
class BrowserExtensionStorage extends StorageAdapter {
  constructor() {
    super();
    // Use browser or chrome API
    this.api = typeof browser !== 'undefined' ? browser : chrome;
  }

  async get(key) {
    const result = await this.api.storage.local.get(key);
    return result[key];
  }

  async set(key, value) {
    await this.api.storage.local.set({ [key]: value });
  }

  async remove(key) {
    await this.api.storage.local.remove(key);
  }

  // Listen for changes
  onChanged(callback) {
    this.api.storage.onChanged.addListener((changes, area) => {
      if (area === 'local') {
        callback(changes);
      }
    });
  }
}

/**
 * Capacitor Preferences Storage Adapter (Mobile)
 */
class CapacitorStorage extends StorageAdapter {
  constructor(Preferences) {
    super();
    this.Preferences = Preferences;
  }

  async get(key) {
    const { value } = await this.Preferences.get({ key });
    return value ? JSON.parse(value) : null;
  }

  async set(key, value) {
    await this.Preferences.set({ key, value: JSON.stringify(value) });
  }

  async remove(key) {
    await this.Preferences.remove({ key });
  }
}

/**
 * LocalStorage Adapter (Web fallback)
 */
class LocalStorageAdapter extends StorageAdapter {
  async get(key) {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  }

  async set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  async remove(key) {
    localStorage.removeItem(key);
  }
}

/**
 * Unified Storage API
 */
class UnifiedStorage {
  constructor(adapter) {
    this.adapter = adapter;
  }

  // Usage data methods
  async getUsageData() {
    return await this.adapter.get(STORAGE_KEY) || {};
  }

  async saveProviderData(providerId, data) {
    const existing = await this.getUsageData();
    existing[providerId] = {
      ...data,
      lastScraped: new Date().toISOString()
    };
    await this.adapter.set(STORAGE_KEY, existing);
  }

  async clearUsageData() {
    await this.adapter.remove(STORAGE_KEY);
  }

  // Custom pages methods
  async getCustomPages() {
    return await this.adapter.get(CUSTOM_PAGES_KEY) || [];
  }

  async saveCustomPages(pages) {
    await this.adapter.set(CUSTOM_PAGES_KEY, pages);
  }

  async addCustomPage(page) {
    const pages = await this.getCustomPages();
    pages.push({
      ...page,
      id: `custom-${Date.now()}`,
      addedAt: new Date().toISOString()
    });
    await this.saveCustomPages(pages);
  }

  async removeCustomPage(pageId) {
    const pages = await this.getCustomPages();
    const filtered = pages.filter(p => p.id !== pageId);
    await this.saveCustomPages(filtered);
  }

  // Last refresh tracking
  async getLastRefresh() {
    return await this.adapter.get(LAST_REFRESH_KEY) || 0;
  }

  async setLastRefresh(timestamp = Date.now()) {
    await this.adapter.set(LAST_REFRESH_KEY, timestamp);
  }
}

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    STORAGE_KEY,
    CUSTOM_PAGES_KEY,
    LAST_REFRESH_KEY,
    StorageAdapter,
    BrowserExtensionStorage,
    CapacitorStorage,
    LocalStorageAdapter,
    UnifiedStorage
  };
} else if (typeof window !== 'undefined') {
  window.StorageLib = {
    STORAGE_KEY,
    CUSTOM_PAGES_KEY,
    LAST_REFRESH_KEY,
    StorageAdapter,
    BrowserExtensionStorage,
    CapacitorStorage,
    LocalStorageAdapter,
    UnifiedStorage
  };
}
