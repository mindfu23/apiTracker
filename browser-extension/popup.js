/**
 * API Usage Scraper - Popup Script
 * Manages the extension popup UI and coordinates scraping actions
 */

const PROVIDERS = [
  {
    id: 'anthropic',
    name: 'Anthropic',
    color: '#f97316',
    abbrev: 'ANT',
    urls: ['console.anthropic.com'],
    dashboardUrl: 'https://console.anthropic.com/settings/usage'
  },
  {
    id: 'openai',
    name: 'OpenAI',
    color: '#10b981',
    abbrev: 'OAI',
    urls: ['platform.openai.com'],
    dashboardUrl: 'https://platform.openai.com/usage'
  },
  {
    id: 'claude-ai',
    name: 'Claude.ai',
    color: '#f97316',
    abbrev: 'CLD',
    urls: ['claude.ai'],
    dashboardUrl: 'https://claude.ai/settings/usage'
  },
  {
    id: 'github-copilot',
    name: 'GitHub Copilot',
    color: '#1f2937',
    abbrev: 'GH',
    urls: ['github.com/settings/billing'],
    dashboardUrl: 'https://github.com/settings/billing/premium_requests_usage'
  },
  {
    id: 'google-cloud',
    name: 'Google Cloud',
    color: '#3b82f6',
    abbrev: 'GCP',
    urls: ['console.cloud.google.com'],
    dashboardUrl: 'https://console.cloud.google.com/billing'
  },
  {
    id: 'perplexity',
    name: 'Perplexity',
    color: '#06b6d4',
    abbrev: 'PPX',
    urls: ['perplexity.ai/settings'],
    dashboardUrl: 'https://www.perplexity.ai/settings/api'
  }
];

// Storage key for collected data
const STORAGE_KEY = 'api_usage_data';

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  await renderProviderList();
  setupEventListeners();
});

async function renderProviderList() {
  const container = document.getElementById('providerList');
  const storedData = await getStoredData();

  container.innerHTML = PROVIDERS.map(provider => {
    const data = storedData[provider.id];
    const hasData = data && data.lastScraped;
    const timeAgo = hasData ? getTimeAgo(new Date(data.lastScraped)) : null;

    return `
      <button class="provider-btn ${hasData ? 'has-data' : ''}" data-provider="${provider.id}">
        <div class="provider-icon" style="background: ${provider.color}">
          ${provider.abbrev}
        </div>
        <div class="provider-info">
          <div class="provider-name">${provider.name}</div>
          <div class="provider-status ${hasData ? 'success' : ''}">
            ${hasData ? `Updated ${timeAgo}` : 'No data yet'}
          </div>
        </div>
        <div class="scrape-indicator ${hasData ? 'active' : ''}"></div>
      </button>
    `;
  }).join('');

  // Add click handlers for provider buttons
  container.querySelectorAll('.provider-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const providerId = btn.dataset.provider;
      const provider = PROVIDERS.find(p => p.id === providerId);
      if (provider) {
        openProviderDashboard(provider);
      }
    });
  });
}

function setupEventListeners() {
  // Scrape current page
  document.getElementById('scrapeCurrentBtn').addEventListener('click', async () => {
    const btn = document.getElementById('scrapeCurrentBtn');
    btn.textContent = 'Scraping...';
    btn.classList.add('loading');
    btn.disabled = true;

    try {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      const result = await browser.tabs.sendMessage(tab.id, { action: 'scrape' });

      if (result && result.success) {
        await saveScrapedData(result.provider, result.data);
        showDataPreview(result.data);
        await renderProviderList();
        btn.textContent = 'Scraped!';
      } else {
        btn.textContent = result?.error || 'No data found';
      }
    } catch (error) {
      console.error('Scrape error:', error);
      btn.textContent = 'Not on supported page';
    }

    setTimeout(() => {
      btn.textContent = 'Scrape Current Page';
      btn.classList.remove('loading');
      btn.disabled = false;
    }, 2000);
  });

  // View dashboard
  document.getElementById('viewDashboardBtn').addEventListener('click', () => {
    browser.tabs.create({ url: browser.runtime.getURL('dashboard.html') });
  });

  // Export to API Tracker
  document.getElementById('exportBtn').addEventListener('click', async () => {
    const btn = document.getElementById('exportBtn');
    const data = await getStoredData();

    // Copy to clipboard as JSON
    const exportData = {
      exportedAt: new Date().toISOString(),
      providers: data
    };

    try {
      await navigator.clipboard.writeText(JSON.stringify(exportData, null, 2));
      btn.textContent = 'Copied to clipboard!';
    } catch (e) {
      // Fallback: open in new tab
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      browser.tabs.create({ url });
      btn.textContent = 'Opened in new tab';
    }

    setTimeout(() => {
      btn.textContent = 'Export to API Tracker';
    }, 2000);
  });
}

async function openProviderDashboard(provider) {
  // Check if already on the provider's page
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  const isOnProvider = provider.urls.some(url => tab.url.includes(url));

  if (isOnProvider) {
    // Already on the page, trigger scrape
    document.getElementById('scrapeCurrentBtn').click();
  } else {
    // Open the dashboard
    browser.tabs.create({ url: provider.dashboardUrl });
  }
}

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

function showDataPreview(data) {
  const preview = document.getElementById('dataPreview');
  preview.style.display = 'block';

  const rows = Object.entries(data)
    .filter(([key]) => !key.startsWith('_') && key !== 'lastScraped')
    .map(([key, value]) => {
      const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
      const displayValue = typeof value === 'object' ? JSON.stringify(value) : value;
      return `<div class="data-row"><span class="data-label">${label}</span><span class="data-value">${displayValue}</span></div>`;
    })
    .join('');

  preview.innerHTML = rows || '<div class="data-row">No data available</div>';
}

function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
