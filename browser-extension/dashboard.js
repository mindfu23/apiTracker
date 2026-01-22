/**
 * API Usage Dashboard - Main Script
 * Displays collected scraping data in a dashboard view
 */

const STORAGE_KEY = 'api_usage_data';

const PROVIDER_CONFIG = {
  'anthropic': { name: 'Anthropic', color: '#f97316', abbrev: 'ANT' },
  'openai': { name: 'OpenAI', color: '#10b981', abbrev: 'OAI' },
  'claude-ai': { name: 'Claude.ai', color: '#f97316', abbrev: 'CLD' },
  'github-copilot': { name: 'GitHub Copilot', color: '#1f2937', abbrev: 'GH' },
  'google-cloud': { name: 'Google Cloud', color: '#3b82f6', abbrev: 'GCP' },
  'perplexity': { name: 'Perplexity', color: '#06b6d4', abbrev: 'PPX' }
};

document.addEventListener('DOMContentLoaded', () => {
  loadAndRender();
  setupEventListeners();
});

async function loadAndRender() {
  const data = await getStoredData();
  renderProviders(data);
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
          <div class="toggle-raw" onclick="toggleRawData('${providerId}')">
            Show raw data
          </div>
          <div class="raw-data" id="raw-${providerId}" style="display: none;">
            ${JSON.stringify(providerData, null, 2)}
          </div>
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

  // Requests/tokens
  if (data.totalRequests !== undefined) {
    stats.push({ label: 'Total Requests', value: data.totalRequests.toLocaleString() });
  }
  if (data.totalTokens !== undefined) {
    stats.push({ label: 'Total Tokens', value: data.totalTokens.toLocaleString() });
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

function toggleRawData(providerId) {
  const el = document.getElementById(`raw-${providerId}`);
  if (el.style.display === 'none') {
    el.style.display = 'block';
  } else {
    el.style.display = 'none';
  }
}

// Make toggleRawData available globally
window.toggleRawData = toggleRawData;

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
