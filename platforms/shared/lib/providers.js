/**
 * Provider Configuration - Shared across all platforms
 * Defines all supported API providers and their settings
 */

const PROVIDERS = [
  {
    id: 'anthropic',
    name: 'Anthropic API',
    color: '#f97316',
    abbrev: 'ANT',
    urls: ['platform.claude.com', 'console.anthropic.com'],
    dashboardUrl: 'https://platform.claude.com/usage',
    scraper: 'anthropic'
  },
  {
    id: 'openai',
    name: 'OpenAI',
    color: '#10b981',
    abbrev: 'OAI',
    urls: ['platform.openai.com'],
    dashboardUrl: 'https://platform.openai.com/usage',
    scraper: 'openai'
  },
  {
    id: 'claude-ai',
    name: 'Claude.ai',
    color: '#f97316',
    abbrev: 'CLD',
    urls: ['claude.ai/settings'],
    dashboardUrl: 'https://claude.ai/settings/usage',
    scraper: 'claude-ai'
  },
  {
    id: 'github-copilot',
    name: 'GitHub Copilot',
    color: '#1f2937',
    abbrev: 'GH',
    urls: ['github.com/settings/billing'],
    dashboardUrl: 'https://github.com/settings/billing/premium_requests_usage',
    scraper: 'github-copilot'
  },
  {
    id: 'google-cloud',
    name: 'Google Cloud',
    color: '#3b82f6',
    abbrev: 'GCP',
    urls: ['console.cloud.google.com'],
    dashboardUrl: 'https://console.cloud.google.com/billing',
    scraper: 'google-cloud'
  },
  {
    id: 'perplexity',
    name: 'Perplexity',
    color: '#06b6d4',
    abbrev: 'PPX',
    urls: ['perplexity.ai/account', 'perplexity.ai/settings'],
    dashboardUrl: 'https://www.perplexity.ai/account/api/billing',
    scraper: 'perplexity'
  }
];

/**
 * Provider display configuration for dashboard
 */
const PROVIDER_CONFIG = {
  'anthropic': { name: 'Anthropic', color: '#f97316', abbrev: 'ANT', dashboardUrl: 'https://platform.claude.com/usage' },
  'openai': { name: 'OpenAI', color: '#10b981', abbrev: 'OAI', dashboardUrl: 'https://platform.openai.com/usage' },
  'claude-ai': { name: 'Claude.ai', color: '#f97316', abbrev: 'CLD', dashboardUrl: 'https://claude.ai/settings/usage' },
  'github-copilot': { name: 'GitHub Copilot', color: '#1f2937', abbrev: 'GH', dashboardUrl: 'https://github.com/settings/billing/premium_requests_usage' },
  'google-cloud': { name: 'Google Cloud', color: '#3b82f6', abbrev: 'GCP', dashboardUrl: 'https://console.cloud.google.com/billing' },
  'perplexity': { name: 'Perplexity', color: '#06b6d4', abbrev: 'PPX', dashboardUrl: 'https://www.perplexity.ai/account/api/billing' }
};

/**
 * Find provider by URL
 * @param {string} url - URL to check
 * @returns {Object|null} Provider config or null
 */
function findProviderByUrl(url) {
  return PROVIDERS.find(p => p.urls.some(u => url.includes(u))) || null;
}

/**
 * Get provider by ID
 * @param {string} id - Provider ID
 * @returns {Object|null} Provider config or null
 */
function getProviderById(id) {
  return PROVIDERS.find(p => p.id === id) || null;
}

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PROVIDERS, PROVIDER_CONFIG, findProviderByUrl, getProviderById };
} else if (typeof window !== 'undefined') {
  window.ProviderConfig = { PROVIDERS, PROVIDER_CONFIG, findProviderByUrl, getProviderById };
}
