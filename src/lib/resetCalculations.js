/**
 * Reset time calculation utilities for API usage tracking
 */

/**
 * Calculate reset information based on reset period
 * @param {string} resetPeriod - 'per-minute' | 'hourly' | 'daily' | 'weekly' | 'monthly'
 * @param {string|null} customResetDate - Optional ISO8601 date string for custom reset
 * @returns {{resetDate: Date, timeRemaining: number, formatted: string}}
 */
export function calculateResetInfo(resetPeriod, customResetDate = null) {
  const now = new Date();
  let resetDate;

  // If a custom reset date is provided (e.g., from API headers), use it
  if (customResetDate) {
    resetDate = new Date(customResetDate);
    if (!isNaN(resetDate.getTime())) {
      return formatResetInfo(resetDate, now);
    }
  }

  // Calculate based on reset period
  switch (resetPeriod) {
    case 'per-minute':
      resetDate = new Date(now);
      resetDate.setSeconds(60, 0);
      break;

    case 'hourly':
      resetDate = new Date(now);
      resetDate.setHours(resetDate.getHours() + 1, 0, 0, 0);
      break;

    case 'daily':
      resetDate = new Date(now);
      resetDate.setDate(resetDate.getDate() + 1);
      resetDate.setHours(0, 0, 0, 0);
      break;

    case 'weekly':
      resetDate = new Date(now);
      // Reset on Sunday at midnight
      const daysUntilSunday = (7 - resetDate.getDay()) % 7 || 7;
      resetDate.setDate(resetDate.getDate() + daysUntilSunday);
      resetDate.setHours(0, 0, 0, 0);
      break;

    case 'monthly':
    default:
      resetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
      break;
  }

  return formatResetInfo(resetDate, now);
}

/**
 * Format reset info with time remaining
 * @param {Date} resetDate
 * @param {Date} now
 */
function formatResetInfo(resetDate, now) {
  const timeRemaining = Math.max(0, resetDate.getTime() - now.getTime());

  return {
    resetDate,
    timeRemaining,
    formatted: formatDuration(timeRemaining),
    resetDateFormatted: formatResetDate(resetDate)
  };
}

/**
 * Format duration in human-readable form
 * @param {number} ms - Duration in milliseconds
 * @returns {string} Formatted duration like "6d 14h 23m" or "45m 12s"
 */
export function formatDuration(ms) {
  if (ms <= 0) return 'Now';

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  const remainingHours = hours % 24;
  const remainingMinutes = minutes % 60;
  const remainingSeconds = seconds % 60;

  const parts = [];

  if (days > 0) {
    parts.push(`${days}d`);
    parts.push(`${remainingHours}h`);
    if (days < 7) parts.push(`${remainingMinutes}m`);
  } else if (hours > 0) {
    parts.push(`${remainingHours}h`);
    parts.push(`${remainingMinutes}m`);
  } else if (minutes > 0) {
    parts.push(`${remainingMinutes}m`);
    parts.push(`${remainingSeconds}s`);
  } else {
    parts.push(`${remainingSeconds}s`);
  }

  return parts.join(' ');
}

/**
 * Format reset date for display
 * @param {Date} date
 * @returns {string} Formatted date like "Feb 1, 2026"
 */
export function formatResetDate(date) {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

/**
 * Get human-readable label for reset period
 * @param {string} period
 * @returns {string}
 */
export function getResetPeriodLabel(period) {
  const labels = {
    'per-minute': 'Per Minute',
    'hourly': 'Hourly',
    'daily': 'Daily',
    'weekly': 'Weekly',
    'monthly': 'Monthly'
  };
  return labels[period] || 'Monthly';
}

/**
 * Calculate usage percentage with clamping
 * @param {number} usage - Current usage
 * @param {number} limit - Usage limit
 * @returns {number} Percentage (0-100+, can exceed 100)
 */
export function calculatePercentage(usage, limit) {
  if (!limit || limit <= 0) return 0;
  return (usage / limit) * 100;
}

/**
 * Get color class based on usage percentage
 * @param {number} percentage
 * @returns {string} Tailwind color class
 */
export function getUsageColorClass(percentage) {
  if (percentage >= 100) return 'text-red-600';
  if (percentage >= 90) return 'text-red-500';
  if (percentage >= 75) return 'text-yellow-500';
  return 'text-green-500';
}

/**
 * Get background color class for gauge
 * @param {number} percentage
 * @returns {string} Tailwind background color class
 */
export function getGaugeColorClass(percentage) {
  if (percentage >= 100) return 'stroke-red-600';
  if (percentage >= 90) return 'stroke-red-500';
  if (percentage >= 75) return 'stroke-yellow-500';
  return 'stroke-green-500';
}

/**
 * Detect subscription tier based on rate limits
 * @param {string} provider - Provider name
 * @param {number} requestLimit - Requests per minute/period limit
 * @returns {string} Tier name
 */
export function detectTier(provider, requestLimit) {
  const tierMappings = {
    anthropic: [
      { limit: 4000, tier: 'Tier 4' },
      { limit: 2000, tier: 'Tier 3' },
      { limit: 1000, tier: 'Tier 2' },
      { limit: 60, tier: 'Tier 1' },
      { limit: 0, tier: 'Free' }
    ],
    openai: [
      { limit: 10000, tier: 'Tier 5' },
      { limit: 5000, tier: 'Tier 4' },
      { limit: 3500, tier: 'Tier 3' },
      { limit: 500, tier: 'Tier 2' },
      { limit: 60, tier: 'Tier 1' },
      { limit: 0, tier: 'Free' }
    ],
    gemini: [
      { limit: 4000, tier: 'Tier 3' },
      { limit: 1000, tier: 'Tier 2' },
      { limit: 300, tier: 'Tier 1' },
      { limit: 15, tier: 'Free' }
    ],
    perplexity: [
      { limit: 500, tier: 'Pro' },
      { limit: 50, tier: 'Free' }
    ]
  };

  const providerKey = provider.toLowerCase();
  const tiers = tierMappings[providerKey];

  if (!tiers) return 'Unknown';

  for (const { limit, tier } of tiers) {
    if (requestLimit >= limit) return tier;
  }

  return 'Free';
}

/**
 * Format currency for display
 * @param {number} amount
 * @param {string} currency
 * @returns {string}
 */
export function formatCurrency(amount, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

/**
 * Format large numbers with commas
 * @param {number} num
 * @returns {string}
 */
export function formatNumber(num) {
  return new Intl.NumberFormat('en-US').format(num);
}
