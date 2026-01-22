import React, { useState } from 'react';
import UsageGauge, { MiniGauge } from './UsageGauge';
import ResetCountdown from './ResetCountdown';
import SubscriptionBadge, { ProviderBadge, StatusIndicator } from './SubscriptionBadge';
import { formatCurrency, formatNumber, calculatePercentage } from '../lib/resetCalculations';

/**
 * Comprehensive provider card showing all usage information
 * @param {Object} props
 * @param {Object} props.provider - Provider configuration object
 * @param {number} props.usage - Current usage count
 * @param {Function} props.onRefresh - Callback to refresh usage data
 * @param {Function} props.onSettings - Callback to open settings
 * @param {boolean} props.isRefreshing - Whether data is being refreshed
 */
export default function ProviderCard({
  provider,
  usage = 0,
  onRefresh,
  onSettings,
  isRefreshing = false
}) {
  const [expanded, setExpanded] = useState(false);

  const {
    id,
    name,
    limit = 1000,
    color,
    infoUrl,
    linkText,
    resetPeriod = 'monthly',
    resetDate,
    subscriptionTier,
    currentSpend,
    billingLimit,
    freeTierLimit,
    lastFetchedAt
  } = provider;

  const percentage = calculatePercentage(usage, limit);
  const hasApiKey = !!localStorage.getItem(`api_key_${id}`);

  // Determine status
  const getStatus = () => {
    if (!hasApiKey) return 'inactive';
    if (percentage >= 100) return 'error';
    if (percentage >= 90) return 'warning';
    return 'active';
  };

  return (
    <div className={`
      bg-white rounded-xl border border-gray-200 shadow-sm
      hover:shadow-md transition-shadow duration-200
      overflow-hidden
    `}>
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ProviderBadge provider={name} />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-gray-900">{name}</h3>
                <StatusIndicator status={getStatus()} />
              </div>
              {subscriptionTier && (
                <SubscriptionBadge tier={subscriptionTier} size="sm" />
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onRefresh && (
              <button
                onClick={() => onRefresh(id)}
                disabled={isRefreshing}
                className={`
                  p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100
                  transition-colors ${isRefreshing ? 'animate-spin' : ''}
                `}
                title="Refresh usage data"
              >
                <RefreshIcon />
              </button>
            )}
            {onSettings && (
              <button
                onClick={() => onSettings(id)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                title="Provider settings"
              >
                <SettingsIcon />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-4">
        <div className="flex items-start gap-4">
          {/* Gauge */}
          <div className="flex-shrink-0">
            <UsageGauge
              usage={usage}
              limit={limit}
              unit={resetPeriod === 'per-minute' ? 'req/min' : 'requests'}
              size={100}
              strokeWidth={8}
            />
          </div>

          {/* Details */}
          <div className="flex-1 min-w-0 space-y-3">
            {/* Usage Numbers */}
            <div>
              <div className="text-sm text-gray-500">Usage</div>
              <div className="text-lg font-semibold text-gray-900">
                {formatNumber(usage)} / {formatNumber(limit)}
                <span className="text-sm font-normal text-gray-500 ml-1">
                  {resetPeriod === 'per-minute' ? 'RPM' : 'requests'}
                </span>
              </div>
            </div>

            {/* Cost (if available) */}
            {(currentSpend !== undefined || billingLimit) && (
              <div>
                <div className="text-sm text-gray-500">Spend</div>
                <div className="text-base font-medium">
                  {currentSpend !== undefined ? (
                    <>
                      <span className={currentSpend >= (billingLimit || Infinity) ? 'text-red-600' : 'text-gray-900'}>
                        {formatCurrency(currentSpend)}
                      </span>
                      {billingLimit && (
                        <span className="text-gray-400"> / {formatCurrency(billingLimit)}</span>
                      )}
                    </>
                  ) : billingLimit ? (
                    <span className="text-gray-400">Budget: {formatCurrency(billingLimit)}</span>
                  ) : null}
                </div>
              </div>
            )}

            {/* Reset Countdown */}
            <ResetCountdown
              resetPeriod={resetPeriod}
              customResetDate={resetDate}
              showIcon={true}
              showDate={true}
            />
          </div>
        </div>

        {/* Expandable Details */}
        {expanded && (
          <div className="mt-4 pt-4 border-t border-gray-100 space-y-2 text-sm">
            {freeTierLimit > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-500">Free Tier</span>
                <span className="text-gray-900">{formatNumber(freeTierLimit)} requests</span>
              </div>
            )}
            {lastFetchedAt && (
              <div className="flex justify-between">
                <span className="text-gray-500">Last Updated</span>
                <span className="text-gray-900">
                  {new Date(lastFetchedAt).toLocaleString()}
                </span>
              </div>
            )}
            {!hasApiKey && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2 text-yellow-800">
                No API key configured. Add one in settings to enable usage tracking.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-gray-500 hover:text-gray-700"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>

        {infoUrl && (
          <a
            href={infoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1"
          >
            {linkText || 'View Dashboard'}
            <ExternalLinkIcon />
          </a>
        )}
      </div>
    </div>
  );
}

/**
 * Compact provider card for list views
 */
export function CompactProviderCard({
  provider,
  usage = 0,
  onSettings
}) {
  const { id, name, limit, color, resetPeriod, subscriptionTier } = provider;
  const hasApiKey = !!localStorage.getItem(`api_key_${id}`);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3 hover:shadow-sm transition-shadow">
      <div className="flex items-center gap-3">
        <ProviderBadge provider={name} size="sm" />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900 truncate">{name}</span>
            {subscriptionTier && (
              <SubscriptionBadge tier={subscriptionTier} size="sm" />
            )}
          </div>
          <MiniGauge usage={usage} limit={limit} />
        </div>

        {onSettings && (
          <button
            onClick={() => onSettings(id)}
            className="p-1 text-gray-400 hover:text-gray-600"
          >
            <SettingsIcon className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Provider card skeleton for loading states
 */
export function ProviderCardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 bg-gray-200 rounded-full" />
        <div className="flex-1">
          <div className="h-4 bg-gray-200 rounded w-24 mb-2" />
          <div className="h-3 bg-gray-200 rounded w-16" />
        </div>
      </div>
      <div className="flex gap-4">
        <div className="w-24 h-24 bg-gray-200 rounded-full" />
        <div className="flex-1 space-y-3">
          <div className="h-4 bg-gray-200 rounded w-full" />
          <div className="h-4 bg-gray-200 rounded w-3/4" />
          <div className="h-4 bg-gray-200 rounded w-1/2" />
        </div>
      </div>
    </div>
  );
}

// Icon Components
function RefreshIcon({ className = "w-4 h-4" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}

function SettingsIcon({ className = "w-4 h-4" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function ExternalLinkIcon({ className = "w-3 h-3" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
    </svg>
  );
}
