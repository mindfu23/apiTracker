import React from 'react';
import { calculatePercentage, formatNumber } from '../lib/resetCalculations';

/**
 * Circular gauge component for displaying API usage
 * @param {Object} props
 * @param {number} props.usage - Current usage count
 * @param {number} props.limit - Usage limit
 * @param {string} props.unit - Unit label (e.g., "requests", "tokens")
 * @param {number} props.size - Gauge size in pixels (default: 120)
 * @param {number} props.strokeWidth - Stroke width (default: 10)
 */
export default function UsageGauge({
  usage = 0,
  limit = 1000,
  unit = 'requests',
  size = 120,
  strokeWidth = 10
}) {
  const percentage = calculatePercentage(usage, limit);
  const displayPercentage = Math.min(percentage, 100);

  // SVG calculations
  const center = size / 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (displayPercentage / 100) * circumference;

  // Color based on percentage
  const getStrokeColor = () => {
    if (percentage >= 100) return '#dc2626'; // red-600
    if (percentage >= 90) return '#ef4444';  // red-500
    if (percentage >= 75) return '#eab308';  // yellow-500
    return '#22c55e'; // green-500
  };

  const getTextColor = () => {
    if (percentage >= 100) return 'text-red-600';
    if (percentage >= 90) return 'text-red-500';
    if (percentage >= 75) return 'text-yellow-600';
    return 'text-green-600';
  };

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
        />

        {/* Progress circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={getStrokeColor()}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-500 ease-out"
        />

        {/* Overage indicator (red glow if over 100%) */}
        {percentage > 100 && (
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="#dc2626"
            strokeWidth={strokeWidth + 4}
            strokeOpacity={0.3}
            className="animate-pulse"
          />
        )}
      </svg>

      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-2xl font-bold ${getTextColor()}`}>
          {percentage > 999 ? '999+' : Math.round(percentage)}%
        </span>
        <span className="text-xs text-gray-500 text-center leading-tight">
          {formatNumber(usage)}
          <br />
          / {formatNumber(limit)}
        </span>
        <span className="text-xs text-gray-400">{unit}</span>
      </div>
    </div>
  );
}

/**
 * Mini gauge for compact displays
 */
export function MiniGauge({ usage = 0, limit = 1000 }) {
  const percentage = calculatePercentage(usage, limit);
  const displayPercentage = Math.min(percentage, 100);

  const getBarColor = () => {
    if (percentage >= 100) return 'bg-red-600';
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 75) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <div className="w-full">
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span>{formatNumber(usage)} / {formatNumber(limit)}</span>
        <span className={percentage >= 90 ? 'text-red-500 font-medium' : ''}>
          {Math.round(percentage)}%
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={`${getBarColor()} h-2 rounded-full transition-all duration-500 ease-out`}
          style={{ width: `${displayPercentage}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Semi-circular gauge variant
 */
export function SemiCircleGauge({
  usage = 0,
  limit = 1000,
  unit = 'requests',
  size = 160
}) {
  const percentage = calculatePercentage(usage, limit);
  const displayPercentage = Math.min(percentage, 100);

  const strokeWidth = 12;
  const center = size / 2;
  const radius = (size - strokeWidth) / 2 - 10;
  const circumference = Math.PI * radius; // Half circle
  const strokeDashoffset = circumference - (displayPercentage / 100) * circumference;

  const getStrokeColor = () => {
    if (percentage >= 100) return '#dc2626';
    if (percentage >= 90) return '#ef4444';
    if (percentage >= 75) return '#eab308';
    return '#22c55e';
  };

  return (
    <div className="relative inline-flex flex-col items-center">
      <svg
        width={size}
        height={size / 2 + 20}
        className="overflow-visible"
      >
        {/* Background arc */}
        <path
          d={`M ${strokeWidth / 2 + 10} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2 - 10} ${size / 2}`}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />

        {/* Progress arc */}
        <path
          d={`M ${strokeWidth / 2 + 10} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2 - 10} ${size / 2}`}
          fill="none"
          stroke={getStrokeColor()}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-500 ease-out"
        />
      </svg>

      {/* Center text */}
      <div className="absolute bottom-0 left-0 right-0 text-center pb-2">
        <div className="text-3xl font-bold" style={{ color: getStrokeColor() }}>
          {Math.round(percentage)}%
        </div>
        <div className="text-sm text-gray-600">
          {formatNumber(usage)} / {formatNumber(limit)} {unit}
        </div>
      </div>
    </div>
  );
}
