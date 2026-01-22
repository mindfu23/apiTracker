import React, { useState, useEffect } from 'react';
import { calculateResetInfo, formatDuration, getResetPeriodLabel } from '../lib/resetCalculations';

/**
 * Live countdown timer showing time until API quota reset
 * @param {Object} props
 * @param {string} props.resetPeriod - 'per-minute' | 'hourly' | 'daily' | 'weekly' | 'monthly'
 * @param {string} props.customResetDate - Optional ISO8601 date string for exact reset time
 * @param {boolean} props.showIcon - Show clock icon (default: true)
 * @param {boolean} props.showDate - Show reset date (default: true)
 * @param {boolean} props.compact - Compact display mode (default: false)
 */
export default function ResetCountdown({
  resetPeriod = 'monthly',
  customResetDate = null,
  showIcon = true,
  showDate = true,
  compact = false
}) {
  const [resetInfo, setResetInfo] = useState(() =>
    calculateResetInfo(resetPeriod, customResetDate)
  );

  useEffect(() => {
    // Update immediately when props change
    setResetInfo(calculateResetInfo(resetPeriod, customResetDate));

    // Determine update interval based on reset period
    let interval;
    switch (resetPeriod) {
      case 'per-minute':
        interval = 1000; // Update every second
        break;
      case 'hourly':
        interval = 1000; // Update every second
        break;
      case 'daily':
        interval = 60000; // Update every minute
        break;
      default:
        interval = 60000; // Update every minute for weekly/monthly
    }

    const timer = setInterval(() => {
      setResetInfo(calculateResetInfo(resetPeriod, customResetDate));
    }, interval);

    return () => clearInterval(timer);
  }, [resetPeriod, customResetDate]);

  if (compact) {
    return (
      <span className="text-xs text-gray-500">
        {showIcon && <ClockIcon className="inline w-3 h-3 mr-1" />}
        {resetInfo.formatted}
      </span>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-1 text-sm text-gray-600">
        {showIcon && <ClockIcon className="w-4 h-4" />}
        <span className="font-medium">Resets in {resetInfo.formatted}</span>
      </div>
      {showDate && (
        <div className="text-xs text-gray-400 ml-5">
          {resetInfo.resetDateFormatted} ({getResetPeriodLabel(resetPeriod)})
        </div>
      )}
    </div>
  );
}

/**
 * Inline reset timer for compact displays
 */
export function InlineResetTimer({
  resetPeriod = 'monthly',
  customResetDate = null
}) {
  const [resetInfo, setResetInfo] = useState(() =>
    calculateResetInfo(resetPeriod, customResetDate)
  );

  useEffect(() => {
    setResetInfo(calculateResetInfo(resetPeriod, customResetDate));

    const interval = resetPeriod === 'per-minute' || resetPeriod === 'hourly'
      ? 1000
      : 60000;

    const timer = setInterval(() => {
      setResetInfo(calculateResetInfo(resetPeriod, customResetDate));
    }, interval);

    return () => clearInterval(timer);
  }, [resetPeriod, customResetDate]);

  // Urgency color based on time remaining
  const getUrgencyClass = () => {
    const minutesRemaining = resetInfo.timeRemaining / 60000;
    if (minutesRemaining < 5) return 'text-red-500 font-medium';
    if (minutesRemaining < 30) return 'text-yellow-600';
    return 'text-gray-600';
  };

  return (
    <span className={getUrgencyClass()}>
      {resetInfo.formatted}
    </span>
  );
}

/**
 * Reset badge showing period and next reset
 */
export function ResetBadge({
  resetPeriod = 'monthly',
  customResetDate = null
}) {
  const [resetInfo, setResetInfo] = useState(() =>
    calculateResetInfo(resetPeriod, customResetDate)
  );

  useEffect(() => {
    setResetInfo(calculateResetInfo(resetPeriod, customResetDate));

    const interval = resetPeriod === 'per-minute' || resetPeriod === 'hourly'
      ? 1000
      : 60000;

    const timer = setInterval(() => {
      setResetInfo(calculateResetInfo(resetPeriod, customResetDate));
    }, interval);

    return () => clearInterval(timer);
  }, [resetPeriod, customResetDate]);

  const getBadgeColor = () => {
    switch (resetPeriod) {
      case 'per-minute':
        return 'bg-purple-100 text-purple-700';
      case 'hourly':
        return 'bg-blue-100 text-blue-700';
      case 'daily':
        return 'bg-green-100 text-green-700';
      case 'weekly':
        return 'bg-yellow-100 text-yellow-700';
      case 'monthly':
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="flex items-center gap-2">
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getBadgeColor()}`}>
        {getResetPeriodLabel(resetPeriod)}
      </span>
      <span className="text-xs text-gray-500">
        {resetInfo.formatted} until reset
      </span>
    </div>
  );
}

/**
 * Simple clock icon component
 */
function ClockIcon({ className = "w-4 h-4" }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}
