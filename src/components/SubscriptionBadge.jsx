import React from 'react';

/**
 * Badge component showing subscription tier
 * @param {Object} props
 * @param {string} props.tier - Tier name (e.g., "Pro", "Max", "Free", "Tier 1")
 * @param {string} props.size - Badge size: 'sm' | 'md' | 'lg' (default: 'md')
 */
export default function SubscriptionBadge({ tier = 'Free', size = 'md' }) {
  const normalizedTier = tier?.toLowerCase() || 'free';

  // Determine badge styling based on tier
  const getBadgeStyle = () => {
    // Premium tiers
    if (['max', 'enterprise', 'tier 4', 'tier 5', 'ultimate'].includes(normalizedTier)) {
      return {
        bg: 'bg-gradient-to-r from-amber-400 to-yellow-500',
        text: 'text-amber-900',
        border: 'border-amber-300',
        icon: 'crown'
      };
    }

    // Pro / Mid tiers
    if (['pro', 'tier 2', 'tier 3', 'plus', 'premium'].includes(normalizedTier)) {
      return {
        bg: 'bg-gradient-to-r from-blue-500 to-indigo-500',
        text: 'text-white',
        border: 'border-blue-400',
        icon: 'star'
      };
    }

    // Basic paid tiers
    if (['tier 1', 'basic', 'starter', 'hobby'].includes(normalizedTier)) {
      return {
        bg: 'bg-gradient-to-r from-green-400 to-emerald-500',
        text: 'text-white',
        border: 'border-green-400',
        icon: 'check'
      };
    }

    // Free tier
    return {
      bg: 'bg-gray-100',
      text: 'text-gray-600',
      border: 'border-gray-300',
      icon: 'none'
    };
  };

  const getSizeClass = () => {
    switch (size) {
      case 'sm':
        return 'text-xs px-1.5 py-0.5';
      case 'lg':
        return 'text-sm px-3 py-1.5';
      case 'md':
      default:
        return 'text-xs px-2 py-1';
    }
  };

  const style = getBadgeStyle();
  const sizeClass = getSizeClass();

  return (
    <span
      className={`
        inline-flex items-center gap-1 rounded-full font-medium
        ${style.bg} ${style.text} ${sizeClass}
        border ${style.border}
        shadow-sm
      `}
    >
      {style.icon !== 'none' && (
        <BadgeIcon type={style.icon} size={size} />
      )}
      {tier}
    </span>
  );
}

/**
 * Provider logo/icon badge
 * @param {Object} props
 * @param {string} props.provider - Provider name
 * @param {string} props.size - Size: 'sm' | 'md' | 'lg'
 */
export function ProviderBadge({ provider, size = 'md' }) {
  const getProviderStyle = () => {
    const providerLower = provider?.toLowerCase() || '';

    const styles = {
      openai: { bg: 'bg-emerald-500', text: 'text-white', abbrev: 'OAI' },
      anthropic: { bg: 'bg-orange-500', text: 'text-white', abbrev: 'ANT' },
      claude: { bg: 'bg-orange-500', text: 'text-white', abbrev: 'CLD' },
      perplexity: { bg: 'bg-cyan-500', text: 'text-white', abbrev: 'PPX' },
      gemini: { bg: 'bg-blue-500', text: 'text-white', abbrev: 'GEM' },
      google: { bg: 'bg-blue-500', text: 'text-white', abbrev: 'GCP' },
      groq: { bg: 'bg-purple-500', text: 'text-white', abbrev: 'GRQ' },
      cohere: { bg: 'bg-indigo-500', text: 'text-white', abbrev: 'COH' },
      huggingface: { bg: 'bg-yellow-400', text: 'text-gray-900', abbrev: 'HF' },
      'github copilot': { bg: 'bg-gray-800', text: 'text-white', abbrev: 'GH' },
      github: { bg: 'bg-gray-800', text: 'text-white', abbrev: 'GH' }
    };

    return styles[providerLower] || { bg: 'bg-gray-500', text: 'text-white', abbrev: provider?.slice(0, 3).toUpperCase() || '???' };
  };

  const getSizeClass = () => {
    switch (size) {
      case 'sm':
        return 'w-6 h-6 text-xs';
      case 'lg':
        return 'w-10 h-10 text-sm';
      case 'md':
      default:
        return 'w-8 h-8 text-xs';
    }
  };

  const style = getProviderStyle();
  const sizeClass = getSizeClass();

  return (
    <span
      className={`
        inline-flex items-center justify-center rounded-full font-bold
        ${style.bg} ${style.text} ${sizeClass}
      `}
      title={provider}
    >
      {style.abbrev}
    </span>
  );
}

/**
 * Status indicator dot
 * @param {Object} props
 * @param {'active' | 'warning' | 'error' | 'inactive'} props.status
 */
export function StatusIndicator({ status = 'active' }) {
  const getStatusStyle = () => {
    switch (status) {
      case 'active':
        return 'bg-green-500';
      case 'warning':
        return 'bg-yellow-500';
      case 'error':
        return 'bg-red-500';
      case 'inactive':
      default:
        return 'bg-gray-400';
    }
  };

  return (
    <span className={`w-2 h-2 rounded-full ${getStatusStyle()}`} />
  );
}

/**
 * Combined provider + tier badge
 */
export function ProviderTierBadge({ provider, tier }) {
  return (
    <div className="flex items-center gap-2">
      <ProviderBadge provider={provider} size="sm" />
      <SubscriptionBadge tier={tier} size="sm" />
    </div>
  );
}

/**
 * Icon component for badges
 */
function BadgeIcon({ type, size = 'md' }) {
  const sizeClass = size === 'sm' ? 'w-3 h-3' : size === 'lg' ? 'w-5 h-5' : 'w-4 h-4';

  switch (type) {
    case 'crown':
      return (
        <svg className={sizeClass} fill="currentColor" viewBox="0 0 24 24">
          <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z" />
        </svg>
      );
    case 'star':
      return (
        <svg className={sizeClass} fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      );
    case 'check':
      return (
        <svg className={sizeClass} fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      );
    default:
      return null;
  }
}
