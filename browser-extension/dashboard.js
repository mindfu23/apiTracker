/**
 * API Usage Dashboard - Main Script
 * Displays collected scraping data in a dashboard view
 *
 * Features:
 * - Auto-refresh: Triggers background scrape when dashboard opens
 * - Bookmarkable: Can be bookmarked and will refresh data on each visit
 * - Real-time updates: Listens for storage changes
 */

const STORAGE_KEY = 'api_usage_data';
const LAST_REFRESH_KEY = 'last_dashboard_refresh';
const REFRESH_COOLDOWN_MS = 30000; // 30 seconds cooldown between auto-refreshes

const PROVIDER_CONFIG = {
  'anthropic': { name: 'Anthropic', color: '#f97316', abbrev: 'ANT', dashboardUrl: 'https://platform.claude.com/usage' },
  'openai': { name: 'OpenAI', color: '#10b981', abbrev: 'OAI', dashboardUrl: 'https://platform.openai.com/usage' },
  'claude-ai': { name: 'Claude.ai', color: '#f97316', abbrev: 'CLD', dashboardUrl: 'https://claude.ai/settings/usage' },
  'github-copilot': { name: 'GitHub Copilot', color: '#1f2937', abbrev: 'GH', dashboardUrl: 'https://github.com/settings/billing/premium_requests_usage' },
  'google-cloud': { name: 'Google Cloud', color: '#3b82f6', abbrev: 'GCP', dashboardUrl: 'https://console.cloud.google.com/billing' },
  'perplexity': { name: 'Perplexity', color: '#06b6d4', abbrev: 'PPX', dashboardUrl: 'https://www.perplexity.ai/account/api/billing' }
};

document.addEventListener('DOMContentLoaded', async () => {
  loadAndRender();
  setupEventListeners();

  // Auto-refresh on page load (with cooldown to prevent excessive requests)
  await autoRefreshIfNeeded();

  // Listen for storage changes to update in real-time
  browser.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes[STORAGE_KEY]) {
      loadAndRender();
    }
  });
});

// Auto-refresh data when dashboard opens (if cooldown has passed)
async function autoRefreshIfNeeded() {
  const result = await browser.storage.local.get(LAST_REFRESH_KEY);
  const lastRefresh = result[LAST_REFRESH_KEY] || 0;
  const now = Date.now();

  if (now - lastRefresh > REFRESH_COOLDOWN_MS) {
    await browser.storage.local.set({ [LAST_REFRESH_KEY]: now });
    showRefreshStatus('Auto-refreshing data...');

    // Trigger background refresh
    try {
      await browser.runtime.sendMessage({ action: 'refreshAll' });
    } catch (e) {
      // Background script might not support this yet, that's OK
      console.log('Background refresh not available');
    }
  }
}

function showRefreshStatus(message) {
  let statusEl = document.getElementById('refreshStatus');
  if (!statusEl) {
    statusEl = document.createElement('div');
    statusEl.id = 'refreshStatus';
    statusEl.style.cssText = 'position: fixed; top: 10px; right: 10px; background: #3b82f6; color: white; padding: 8px 16px; border-radius: 8px; font-size: 13px; z-index: 1000; transition: opacity 0.3s;';
    document.body.appendChild(statusEl);
  }
  statusEl.textContent = message;
  statusEl.style.opacity = '1';

  setTimeout(() => {
    statusEl.style.opacity = '0';
  }, 3000);
}

async function loadAndRender() {
  const data = await getStoredData();
  renderProviders(data);
  setupToggleListeners(data);
}

async function getStoredData() {
  const result = await browser.storage.local.get(STORAGE_KEY);
  return result[STORAGE_KEY] || {};
}

function renderProviders(data) {
  const grid = document.getElementById('providerGrid');
  const emptyState = document.getElementById('emptyState');

  const providers = Object.entries(data);

  if (providers.length === 0) {
    grid.style.display = 'none';
    emptyState.style.display = 'block';
    return;
  }

  grid.style.display = 'grid';
  emptyState.style.display = 'none';

  grid.innerHTML = providers.map(([providerId, providerData]) => {
    const config = PROVIDER_CONFIG[providerId] || {
      name: providerId,
      color: '#6b7280',
      abbrev: providerId.slice(0, 3).toUpperCase()
    };

    const lastUpdated = providerData.lastScraped
      ? new Date(providerData.lastScraped).toLocaleString()
      : 'Unknown';

    const stats = extractStats(providerId, providerData);

    return `
      <div class="card" data-provider="${providerId}">
        <div class="card-header">
          <div class="provider-icon" style="background: ${config.color}">
            ${config.abbrev}
          </div>
          <div>
            <div class="provider-name">${config.name}</div>
            <div class="last-updated">Updated: ${lastUpdated}</div>
          </div>
        </div>
        <div class="card-body">
          <div class="stat-grid">
            ${stats.map(stat => renderStat(stat)).join('')}
          </div>
          ${renderProgressBar(providerData)}
          <div class="toggle-raw" data-toggle="${providerId}">
            Show raw data
          </div>
          <div class="raw-data" id="raw-${providerId}" style="display: none;"></div>
        </div>
      </div>
    `;
  }).join('');
}

function extractStats(providerId, data) {
  const stats = [];

  // Common patterns
  if (data.creditBalance !== undefined) {
    stats.push({ label: 'Credit Balance', value: `$${data.creditBalance.toFixed(2)}`, type: 'money' });
  }
  if (data.currentBalance !== undefined) {
    stats.push({ label: 'Balance', value: `$${data.currentBalance.toFixed(2)}`, type: 'money' });
  }
  if (data.amountSpent !== undefined) {
    stats.push({ label: 'Spent', value: `$${data.amountSpent.toFixed(2)}`, type: 'money' });
  }
  if (data.totalSpend !== undefined) {
    stats.push({ label: 'Total Spend', value: `$${data.totalSpend.toFixed(2)}`, type: 'money' });
  }
  if (data.extraUsageSpent !== undefined) {
    stats.push({ label: 'Extra Usage', value: `$${data.extraUsageSpent.toFixed(2)}`, type: 'money' });
  }
  if (data.billedAmount !== undefined) {
    stats.push({ label: 'Billed', value: `$${data.billedAmount.toFixed(2)}`, type: 'money' });
  }

  // Usage percentages
  if (data.sessionUsagePercent !== undefined) {
    stats.push({ label: 'Session Usage', value: `${data.sessionUsagePercent}%`, type: getPercentType(data.sessionUsagePercent) });
  }
  if (data.weeklyAllModelsPercent !== undefined) {
    stats.push({ label: 'Weekly Usage', value: `${data.weeklyAllModelsPercent}%`, type: getPercentType(data.weeklyAllModelsPercent) });
  }
  if (data.usagePercent !== undefined) {
    stats.push({ label: 'Usage', value: `${data.usagePercent}%`, type: getPercentType(data.usagePercent) });
  }
  if (data.budgetUsagePercent !== undefined) {
    stats.push({ label: 'Budget Used', value: `${data.budgetUsagePercent}%`, type: getPercentType(data.budgetUsagePercent) });
  }
  if (data.includedUsagePercent !== undefined) {
    stats.push({ label: 'Included Used', value: `${data.includedUsagePercent}%`, type: getPercentType(data.includedUsagePercent) });
  }
  if (data.creditsUsagePercent !== undefined) {
    stats.push({ label: 'Credits Used', value: `${data.creditsUsagePercent}%`, type: getPercentType(data.creditsUsagePercent) });
  }

  // Limits
  if (data.monthlyLimit !== undefined) {
    stats.push({ label: 'Monthly Limit', value: `$${data.monthlyLimit}` });
  }
  if (data.monthlySpendingLimit !== undefined) {
    stats.push({ label: 'Spending Limit', value: `$${data.monthlySpendingLimit}` });
  }
  if (data.budgetLimit !== undefined) {
    stats.push({ label: 'Budget', value: `$${data.budgetLimit}` });
  }
  if (data.includedLimit !== undefined) {
    stats.push({ label: 'Included Limit', value: data.includedLimit.toLocaleString() });
  }
  if (data.includedUsed !== undefined) {
    stats.push({ label: 'Included Used', value: Math.round(data.includedUsed).toLocaleString() });
  }

  // Requests/tokens/API calls
  if (data.totalRequests !== undefined) {
    stats.push({ label: 'Total Requests', value: data.totalRequests.toLocaleString() });
  }
  if (data.totalTokens !== undefined) {
    stats.push({ label: 'Total Tokens', value: data.totalTokens.toLocaleString() });
  }
  if (data.chatCompletionsRequests !== undefined) {
    stats.push({ label: 'Chat Requests', value: data.chatCompletionsRequests.toLocaleString() });
  }
  if (data.imagesRequests !== undefined) {
    stats.push({ label: 'Image Requests', value: data.imagesRequests.toLocaleString() });
  }
  if (data.embeddingsRequests !== undefined) {
    stats.push({ label: 'Embeddings', value: data.embeddingsRequests.toLocaleString() });
  }
  if (data.apiRequestsSection !== undefined && data.totalRequests === undefined) {
    stats.push({ label: 'API Requests', value: 'Available' });
  }

  // Reset info
  if (data.resetInfo) {
    stats.push({ label: 'Reset', value: data.resetInfo });
  }
  if (data.resetInDays !== undefined) {
    stats.push({ label: 'Resets In', value: `${data.resetInDays} days` });
  }
  if (data.sessionResetIn) {
    stats.push({ label: 'Session Reset', value: data.sessionResetIn });
  }

  // Credits
  if (data.creditsRemaining !== undefined) {
    stats.push({ label: 'Credits Left', value: `$${data.creditsRemaining.toFixed(2)}`, type: 'money' });
  }

  // Google Cloud specific
  if (data.creditsUsed !== undefined && data.creditsTotal !== undefined) {
    stats.push({ label: 'Credits Used', value: `$${data.creditsUsed} / $${data.creditsTotal}` });
  }
  if (data.geminiSpend !== undefined) {
    stats.push({ label: 'Gemini Spend', value: `$${data.geminiSpend.toFixed(2)}`, type: 'money' });
  }
  if (data.expirationDate) {
    stats.push({ label: 'Expires', value: data.expirationDate });
  }

  // Anthropic specific
  if (data.totalSpending !== undefined) {
    stats.push({ label: 'Total Spending', value: `$${data.totalSpending.toFixed(2)}`, type: 'money' });
  }
  if (data.thisMonthSpend !== undefined) {
    stats.push({ label: 'This Month', value: `$${data.thisMonthSpend.toFixed(2)}`, type: 'money' });
  }
  if (data.usageTier !== undefined) {
    stats.push({ label: 'Usage Tier', value: `Tier ${data.usageTier}` });
  }
  if (data.rateLimit !== undefined) {
    stats.push({ label: 'Rate Limit', value: `${data.rateLimit.toLocaleString()} RPM` });
  }
  if (data.modelUsage && Object.keys(data.modelUsage).length > 0) {
    const models = Object.entries(data.modelUsage)
      .map(([model, cost]) => `${model}: $${cost}`)
      .join(', ');
    stats.push({ label: 'Model Usage', value: models });
  }

  // Perplexity specific
  if (data.monthlyCredit !== undefined) {
    stats.push({ label: 'Monthly Credit', value: `$${data.monthlyCredit}`, type: 'money' });
  }
  if (data.autoReload) {
    stats.push({ label: 'Auto Reload', value: data.autoReload });
  }
  if (data.subscriptionType) {
    stats.push({ label: 'Subscription', value: data.subscriptionType });
  }
  if (data.sonarRequests !== undefined || data.sonarProRequests !== undefined) {
    const sonar = data.sonarRequests || 0;
    const sonarPro = data.sonarProRequests || 0;
    stats.push({ label: 'Requests', value: `Sonar: ${sonar}, Pro: ${sonarPro}` });
  }

  // Generic fields from generic scraper
  if (data.balance !== undefined) {
    stats.push({ label: 'Balance', value: `$${data.balance.toFixed(2)}`, type: 'money' });
  }
  if (data.spend !== undefined) {
    stats.push({ label: 'Spend', value: `$${data.spend.toFixed(2)}`, type: 'money' });
  }
  if (data.credits !== undefined) {
    stats.push({ label: 'Credits', value: `$${data.credits.toFixed(2)}`, type: 'money' });
  }
  if (data.budget !== undefined && !data.budgetLimit) {
    stats.push({ label: 'Budget', value: `$${data.budget}` });
  }
  if (data.requests !== undefined && !data.totalRequests) {
    stats.push({ label: 'Requests', value: data.requests.toLocaleString() });
  }
  if (data.tokens !== undefined && !data.totalTokens) {
    stats.push({ label: 'Tokens', value: data.tokens.toLocaleString() });
  }
  if (data.plan) {
    stats.push({ label: 'Plan', value: data.plan });
  }

  return stats.slice(0, 6); // Limit to 6 stats for grid layout
}

function getPercentType(percent) {
  if (percent >= 90) return 'danger';
  if (percent >= 70) return 'warning';
  return 'percent';
}

function renderStat(stat) {
  const typeClass = stat.type || '';
  return `
    <div class="stat">
      <div class="stat-label">${stat.label}</div>
      <div class="stat-value ${typeClass}">${stat.value}</div>
    </div>
  `;
}

function renderProgressBar(data) {
  // Find the most relevant percentage
  const percent = data.includedUsagePercent
    || data.budgetUsagePercent
    || data.creditsUsagePercent
    || data.sessionUsagePercent
    || data.usagePercent;

  if (percent === undefined) return '';

  const fillClass = percent >= 90 ? 'high' : percent >= 70 ? 'medium' : 'low';

  return `
    <div class="progress-bar">
      <div class="progress-fill ${fillClass}" style="width: ${Math.min(percent, 100)}%"></div>
    </div>
  `;
}

function setupToggleListeners(data) {
  document.querySelectorAll('.toggle-raw[data-toggle]').forEach(toggleEl => {
    toggleEl.addEventListener('click', () => {
      const providerId = toggleEl.dataset.toggle;
      const rawEl = document.getElementById(`raw-${providerId}`);

      if (rawEl.style.display === 'none' || rawEl.style.display === '') {
        // Populate and show
        const providerData = data[providerId];
        rawEl.textContent = JSON.stringify(providerData, null, 2);
        rawEl.style.display = 'block';
        toggleEl.textContent = 'Hide raw data';
      } else {
        // Hide
        rawEl.style.display = 'none';
        toggleEl.textContent = 'Show raw data';
      }
    });
  });
}

function setupEventListeners() {
  document.getElementById('refreshBtn').addEventListener('click', loadAndRender);

  document.getElementById('exportBtn').addEventListener('click', async () => {
    const data = await getStoredData();
    const exportData = {
      exportedAt: new Date().toISOString(),
      providers: data
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `api-usage-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById('clearBtn').addEventListener('click', async () => {
    if (confirm('Clear all collected data?')) {
      await browser.storage.local.remove(STORAGE_KEY);
      loadAndRender();
    }
  });
}
