/**
 * Utility Functions - Shared across all platforms
 */

/**
 * Format time ago string
 * @param {Date} date - Date to format
 * @returns {string} Human-readable time ago string
 */
function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

/**
 * Format currency value
 * @param {number} value - Value to format
 * @param {string} currency - Currency code (default: USD)
 * @returns {string} Formatted currency string
 */
function formatCurrency(value, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency
  }).format(value);
}

/**
 * Format number with locale
 * @param {number} value - Value to format
 * @returns {string} Formatted number string
 */
function formatNumber(value) {
  return value.toLocaleString();
}

/**
 * Get usage percent type for styling
 * @param {number} percent - Usage percentage
 * @returns {string} Type: 'danger', 'warning', or 'normal'
 */
function getPercentType(percent) {
  if (percent >= 90) return 'danger';
  if (percent >= 70) return 'warning';
  return 'normal';
}

/**
 * Check if URL contains billing-related keywords
 * @param {string} url - URL to check
 * @returns {boolean} True if URL appears to be a billing page
 */
function isBillingUrl(url) {
  const billingKeywords = ['billing', 'usage', 'credits', 'account', 'subscription', 'plan', 'cost', 'spend', 'payment'];
  return billingKeywords.some(kw => url.toLowerCase().includes(kw));
}

/**
 * Extract hostname from URL
 * @param {string} url - Full URL
 * @returns {string} Hostname
 */
function getHostname(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/**
 * Debounce function
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in ms
 * @returns {Function} Debounced function
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Generate unique ID
 * @returns {string} Unique identifier
 */
function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getTimeAgo,
    formatCurrency,
    formatNumber,
    getPercentType,
    isBillingUrl,
    getHostname,
    debounce,
    generateId
  };
} else if (typeof window !== 'undefined') {
  window.Utils = {
    getTimeAgo,
    formatCurrency,
    formatNumber,
    getPercentType,
    isBillingUrl,
    getHostname,
    debounce,
    generateId
  };
}
