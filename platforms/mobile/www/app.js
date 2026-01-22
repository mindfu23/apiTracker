/**
 * API Tracker Mobile App
 * Uses Capacitor for native functionality with WebView-based scraping
 */

import { Preferences } from '@capacitor/preferences';
import { Browser } from '@capacitor/browser';

// Storage key
const STORAGE_KEY = 'api_usage_data';

// Provider configurations
const PROVIDERS = [
  {
    id: 'anthropic',
    name: 'Anthropic API',
    color: '#f97316',
    abbrev: 'ANT',
    dashboardUrl: 'https://platform.claude.com/usage'
  },
  {
    id: 'openai',
    name: 'OpenAI',
    color: '#10b981',
    abbrev: 'OAI',
    dashboardUrl: 'https://platform.openai.com/usage'
  },
  {
    id: 'claude-ai',
    name: 'Claude.ai',
    color: '#f97316',
    abbrev: 'CLD',
    dashboardUrl: 'https://claude.ai/settings/usage'
  },
  {
    id: 'github-copilot',
    name: 'GitHub Copilot',
    color: '#1f2937',
    abbrev: 'GH',
    dashboardUrl: 'https://github.com/settings/billing/premium_requests_usage'
  },
  {
    id: 'google-cloud',
    name: 'Google Cloud',
    color: '#3b82f6',
    abbrev: 'GCP',
    dashboardUrl: 'https://console.cloud.google.com/billing'
  },
  {
    id: 'perplexity',
    name: 'Perplexity',
    color: '#06b6d4',
    abbrev: 'PPX',
    dashboardUrl: 'https://www.perplexity.ai/account/api/billing'
  }
];

// Current scraping state
let currentProviderId = null;
let scrapeStatus = {};

// Storage helpers using Capacitor Preferences
async function getStoredData() {
  const { value } = await Preferences.get({ key: STORAGE_KEY });
  return value ? JSON.parse(value) : {};
}

async function saveProviderData(providerId, data) {
  const existing = await getStoredData();
  existing[providerId] = {
    ...data,
    lastScraped: new Date().toISOString()
  };
  await Preferences.set({ key: STORAGE_KEY, value: JSON.stringify(existing) });
}

async function clearAllData() {
  await Preferences.remove({ key: STORAGE_KEY });
}

// Time formatting
function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

// Update scrape status
function updateScrapeStatus(providerId, status, errorMessage = null) {
  scrapeStatus[providerId] = {
    status,
    errorMessage,
    timestamp: Date.now()
  };
  renderProviderList();
}

// Render provider list
async function renderProviderList() {
  const container = document.getElementById('providerList');
  const storedData = await getStoredData();

  container.innerHTML = PROVIDERS.map(provider => {
    const data = storedData[provider.id];
    const hasData = data && data.lastScraped;
    const timeAgo = hasData ? getTimeAgo(data.lastScraped) : null;

    const status = scrapeStatus[provider.id];
    const isRecentStatus = status && (Date.now() - status.timestamp < 10000);

    let statusHtml = '';
    let statusClass = hasData ? 'success' : '';

    if (isRecentStatus) {
      if (status.status === 'success') {
        statusHtml = '<div class="scrape-result scrape-success">Scraped successfully</div>';
      } else if (status.status === 'error') {
        statusHtml = `<div class="scrape-result scrape-error">${status.errorMessage || 'Scrape failed'}</div>`;
      } else if (status.status === 'loading') {
        statusHtml = '<div class="scrape-result scrape-loading">Opening page...</div>';
      }
    }

    // Build stats HTML if we have data
    let statsHtml = '';
    if (hasData && data) {
      const stats = [];
      if (data.creditBalance !== undefined) stats.push({ label: 'Balance', value: `$${data.creditBalance}` });
      if (data.totalSpend !== undefined) stats.push({ label: 'Spent', value: `$${data.totalSpend}` });
      if (data.usagePercent !== undefined) stats.push({ label: 'Used', value: `${data.usagePercent}%` });
      if (data.totalTokens !== undefined) stats.push({ label: 'Tokens', value: data.totalTokens.toLocaleString() });
      if (data.totalRequests !== undefined) stats.push({ label: 'Requests', value: data.totalRequests.toLocaleString() });
      if (data.resetInDays !== undefined) stats.push({ label: 'Resets', value: `${data.resetInDays}d` });

      if (stats.length > 0) {
        statsHtml = `
          <div class="provider-stats">
            ${stats.slice(0, 4).map(s => `
              <div class="stat-item">
                <div class="stat-value">${s.value}</div>
                <div class="stat-label">${s.label}</div>
              </div>
            `).join('')}
          </div>
        `;
      }
    }

    return `
      <div class="provider-card ${hasData ? 'has-data' : ''} ${isRecentStatus && status.status === 'loading' ? 'scraping' : ''}"
           data-provider="${provider.id}">
        <div class="provider-icon" style="background: ${provider.color}">
          ${provider.abbrev}
        </div>
        <div class="provider-info">
          <div class="provider-name">${provider.name}</div>
          <div class="provider-status ${statusClass}">
            ${hasData ? `Updated ${timeAgo}` : 'Tap to collect data'}
          </div>
          ${statusHtml}
          ${statsHtml}
        </div>
        <span class="chevron">›</span>
      </div>
    `;
  }).join('');

  // Add click handlers
  container.querySelectorAll('.provider-card').forEach(card => {
    card.addEventListener('click', () => {
      const providerId = card.dataset.provider;
      openProviderPage(providerId);
    });
  });
}

// Open provider page in browser
async function openProviderPage(providerId) {
  const provider = PROVIDERS.find(p => p.id === providerId);
  if (!provider) return;

  currentProviderId = providerId;
  updateScrapeStatus(providerId, 'loading');

  // Open in system browser (user will need to manually come back)
  // For better UX, we use Browser plugin which shows an in-app browser
  await Browser.open({
    url: provider.dashboardUrl,
    presentationStyle: 'popover'
  });

  // Listen for browser close
  Browser.addListener('browserFinished', async () => {
    // Browser was closed - prompt user about scraping
    // In a real implementation, you might use a custom WebView with JS injection
    console.log('Browser closed for provider:', providerId);
  });
}

// Setup event listeners
function setupEventListeners() {
  // Refresh all button
  document.getElementById('refreshAllBtn').addEventListener('click', async () => {
    // This would ideally refresh all providers
    // For now, show a message that user needs to tap each provider
    alert('Tap on each provider to open their usage page and collect data.');
  });

  // Clear data button
  document.getElementById('clearDataBtn').addEventListener('click', async () => {
    if (confirm('Clear all collected data?')) {
      await clearAllData();
      scrapeStatus = {};
      renderProviderList();
    }
  });
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  renderProviderList();
  setupEventListeners();
});

// Re-render when app comes back to foreground
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    renderProviderList();
  }
});
