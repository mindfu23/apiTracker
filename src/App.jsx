import React, { useState, useEffect, useCallback } from 'react';
import SettingsModal from './components/SettingsModal';
import ProviderCard, { ProviderCardSkeleton } from './components/ProviderCard';
import { useAuth, AuthModal } from './lib/auth';

const DEFAULT_PROVIDERS = [];

function App() {
  const [providers, setProviders] = useState(() => {
    const saved = localStorage.getItem('api_providers');
    return saved ? JSON.parse(saved) : DEFAULT_PROVIDERS;
  });
  const [apiUsage, setApiUsage] = useState({});
  const [lastUpdated, setLastUpdated] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshingProvider, setRefreshingProvider] = useState(null);
  const { user, logout, setShowAuthModal } = useAuth();

  // Save providers to localStorage when they change
  useEffect(() => {
    localStorage.setItem('api_providers', JSON.stringify(providers));
  }, [providers]);

  // Fetch usage data for all providers
  const fetchUsageData = useCallback(async () => {
    setIsRefreshing(true);

    // Check for local keys
    const localKeys = {};
    let hasLocalKeys = false;
    providers.forEach(p => {
      const key = localStorage.getItem(`api_key_${p.id}`);
      if (key) {
        localKeys[p.id] = key;
        hasLocalKeys = true;
      }
    });

    if (hasLocalKeys) {
      // Fetch usage for each provider with a key
      const usagePromises = providers.map(async (p) => {
        if (!localKeys[p.id]) return { id: p.id, usage: 0 };

        try {
          // Test the key and get usage info
          const res = await fetch('/.netlify/functions/test-api-key', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ provider: p.name, apiKey: localKeys[p.id] }),
          });
          const data = await res.json();

          if (data.valid) {
            return {
              id: p.id,
              usage: data.usage || 0,
              limit: data.limit,
              resetDate: data.resetDate,
              subscriptionTier: data.subscriptionTier,
              rateLimits: data.rateLimits,
            };
          }
        } catch (e) {
          console.error(`Error fetching usage for ${p.name}:`, e);
        }

        return { id: p.id, usage: 0 };
      });

      const results = await Promise.all(usagePromises);
      const newUsage = {};
      results.forEach(r => {
        newUsage[r.id] = r.usage;
        // Also update provider with any new info
        if (r.limit || r.subscriptionTier) {
          setProviders(prev => prev.map(p =>
            p.id === r.id
              ? {
                  ...p,
                  ...(r.limit && { limit: r.limit }),
                  ...(r.subscriptionTier && { subscriptionTier: r.subscriptionTier }),
                  ...(r.resetDate && { resetDate: r.resetDate }),
                }
              : p
          ));
        }
      });

      setApiUsage(prev => ({ ...prev, ...newUsage }));
      setLastUpdated(new Date().toLocaleString());
      setIsRefreshing(false);
      return;
    }

    // Fallback: Try fetching from Netlify Function
    try {
      const response = await fetch('/.netlify/functions/get-usage');
      if (response.ok) {
        const data = await response.json();
        setApiUsage(data);
        if (data.last_updated) {
          setLastUpdated(new Date(data.last_updated).toLocaleString());
        }
      } else {
        throw new Error('Function not available');
      }
    } catch {
      // Fallback to static file
      try {
        const response = await fetch('/usage.json');
        const data = await response.json();
        setApiUsage(data);
        if (data.last_updated) {
          setLastUpdated(new Date(data.last_updated).toLocaleString());
        }
      } catch (err) {
        console.error("Failed to load usage data", err);
      }
    }

    setIsRefreshing(false);
  }, [providers]);

  // Initial fetch
  useEffect(() => {
    fetchUsageData();
  }, []);

  // Refresh single provider
  const refreshProvider = async (providerId) => {
    setRefreshingProvider(providerId);
    const provider = providers.find(p => p.id === providerId);
    const apiKey = localStorage.getItem(`api_key_${providerId}`);

    if (!provider || !apiKey) {
      setRefreshingProvider(null);
      return;
    }

    try {
      const res = await fetch('/.netlify/functions/test-api-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: provider.name, apiKey }),
      });
      const data = await res.json();

      if (data.valid) {
        setApiUsage(prev => ({ ...prev, [providerId]: data.usage || 0 }));

        // Update provider info if available
        if (data.limit || data.subscriptionTier || data.resetDate) {
          setProviders(prev => prev.map(p =>
            p.id === providerId
              ? {
                  ...p,
                  ...(data.limit && { limit: data.limit }),
                  ...(data.subscriptionTier && { subscriptionTier: data.subscriptionTier }),
                  ...(data.resetDate && { resetDate: data.resetDate }),
                  lastFetchedAt: new Date().toISOString(),
                }
              : p
          ));
        }
      }
    } catch (e) {
      console.error(`Error refreshing ${provider.name}:`, e);
    }

    setRefreshingProvider(null);
  };

  // Open settings for a specific provider
  const openProviderSettings = (providerId) => {
    setShowSettings(true);
    // Could scroll to provider in settings modal if needed
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">API Usage Tracker</h1>
              {lastUpdated && (
                <p className="text-sm text-gray-500 mt-1">
                  Last updated: {lastUpdated}
                </p>
              )}
            </div>

            <div className="flex items-center gap-3">
              {/* Refresh Button */}
              <button
                onClick={fetchUsageData}
                disabled={isRefreshing}
                className={`p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors ${
                  isRefreshing ? 'animate-spin' : ''
                }`}
                title="Refresh all"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>

              {/* User / Auth */}
              {user ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700 hidden sm:inline">
                    {user.displayName || user.email}
                  </span>
                  <button
                    onClick={logout}
                    className="text-sm text-red-600 hover:text-red-800"
                  >
                    Logout
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  Login
                </button>
              )}

              {/* Settings */}
              <button
                onClick={() => setShowSettings(true)}
                className="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                title="Settings"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Modals */}
        <SettingsModal
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          providers={providers}
          setProviders={setProviders}
        />
        <AuthModal />

        {/* Content */}
        {providers.length === 0 ? (
          /* Empty State */
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <div className="text-6xl mb-4">📊</div>
            <h2 className="text-xl font-semibold text-gray-700 mb-2">
              Welcome to API Tracker!
            </h2>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">
              Track your API usage across OpenAI, Anthropic, Perplexity, Google Gemini, and more.
              Get started by adding your first API provider.
            </p>
            <button
              onClick={() => setShowSettings(true)}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors text-lg"
            >
              + Add Your First API
            </button>
          </div>
        ) : (
          /* Provider Cards */
          <div className="space-y-4">
            {/* Loading Skeleton */}
            {isRefreshing && providers.length > 0 && Object.keys(apiUsage).length === 0 && (
              <>
                <ProviderCardSkeleton />
                <ProviderCardSkeleton />
              </>
            )}

            {/* Provider Cards Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {providers.map(provider => (
                <ProviderCard
                  key={provider.id}
                  provider={provider}
                  usage={apiUsage[provider.id] || 0}
                  onRefresh={refreshProvider}
                  onSettings={openProviderSettings}
                  isRefreshing={refreshingProvider === provider.id}
                />
              ))}
            </div>

            {/* Add More Button */}
            <div className="pt-4">
              <button
                onClick={() => setShowSettings(true)}
                className="w-full bg-white border-2 border-dashed border-gray-300 rounded-xl p-4 text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Add Another API Provider
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-400">
          <p>
            API Usage Tracker - Track your AI API usage in one place
          </p>
        </div>
      </div>
    </div>
  );
}

export default App;
