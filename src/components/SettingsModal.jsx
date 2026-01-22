import React, { useState, useEffect } from 'react';
import { ProviderBadge } from './SubscriptionBadge';

const COLORS = [
  'bg-green-500', 'bg-purple-500', 'bg-blue-500', 'bg-yellow-500',
  'bg-orange-500', 'bg-red-500', 'bg-pink-500', 'bg-indigo-500',
  'bg-teal-500', 'bg-cyan-500'
];

// Provider presets for quick setup
const PROVIDER_PRESETS = {
  openai: {
    name: 'OpenAI',
    limit: 10000,
    resetPeriod: 'monthly',
    infoUrl: 'https://platform.openai.com/usage',
    linkText: 'View Dashboard',
    color: 'bg-green-500',
    hasAdminKey: true,
    description: 'For usage tracking, you need an Admin Key (different from API key)'
  },
  anthropic: {
    name: 'Anthropic',
    limit: 60,
    resetPeriod: 'per-minute',
    infoUrl: 'https://console.anthropic.com/settings/limits',
    linkText: 'View Limits',
    color: 'bg-orange-500',
    description: 'Rate limits auto-detected from API response headers'
  },
  perplexity: {
    name: 'Perplexity',
    limit: 1000,
    resetPeriod: 'monthly',
    infoUrl: 'https://www.perplexity.ai/settings/api',
    linkText: 'API Settings',
    color: 'bg-cyan-500',
    description: 'Pro plan includes $5/month API credit'
  },
  gemini: {
    name: 'Google Gemini',
    limit: 15,
    resetPeriod: 'per-minute',
    infoUrl: 'https://console.cloud.google.com/apis/dashboard',
    linkText: 'Cloud Console',
    color: 'bg-blue-500',
    description: 'Free tier: 15 RPM. Upgrade via Google Cloud billing.'
  },
  groq: {
    name: 'Groq',
    limit: 30,
    resetPeriod: 'per-minute',
    infoUrl: 'https://console.groq.com/keys',
    linkText: 'Console',
    color: 'bg-purple-500',
    description: 'Ultra-fast inference. Rate limits in response headers.'
  },
  cohere: {
    name: 'Cohere',
    limit: 100,
    resetPeriod: 'per-minute',
    infoUrl: 'https://dashboard.cohere.com/api-keys',
    linkText: 'Dashboard',
    color: 'bg-indigo-500',
    description: 'Enterprise-focused NLP APIs'
  },
  huggingface: {
    name: 'HuggingFace',
    limit: 1000,
    resetPeriod: 'hourly',
    infoUrl: 'https://huggingface.co/settings/billing',
    linkText: 'Billing',
    color: 'bg-yellow-500',
    description: 'Inference API with model hosting'
  }
};

export default function SettingsModal({ isOpen, onClose, providers, setProviders }) {
  const [keys, setKeys] = useState({});
  const [providerSettings, setProviderSettings] = useState({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [newApi, setNewApi] = useState({
    name: '',
    limit: 1000,
    billingLimit: '',
    infoUrl: '',
    linkText: '',
    resetPeriod: 'monthly',
    subscriptionTier: ''
  });
  const [testingKey, setTestingKey] = useState(null);
  const [testResults, setTestResults] = useState({});

  useEffect(() => {
    if (isOpen) {
      const loadedKeys = {};
      const loadedSettings = {};
      providers.forEach(p => {
        loadedKeys[p.id] = localStorage.getItem(`api_key_${p.id}`) || '';
        // Also load admin key if exists
        loadedKeys[`${p.id}_admin`] = localStorage.getItem(`api_admin_key_${p.id}`) || '';
        loadedSettings[p.id] = {
          name: p.name,
          limit: p.limit,
          billingLimit: p.billingLimit || '',
          infoUrl: p.infoUrl || '',
          linkText: p.linkText || '',
          resetPeriod: p.resetPeriod || 'monthly',
          subscriptionTier: p.subscriptionTier || '',
        };
      });
      setKeys(loadedKeys);
      setProviderSettings(loadedSettings);
    }
  }, [isOpen, providers]);

  const handleSave = () => {
    // Save API keys to localStorage
    Object.entries(keys).forEach(([id, key]) => {
      if (id.endsWith('_admin')) {
        // Admin key
        const providerId = id.replace('_admin', '');
        if (key) {
          localStorage.setItem(`api_admin_key_${providerId}`, key);
        } else {
          localStorage.removeItem(`api_admin_key_${providerId}`);
        }
      } else {
        // Regular API key
        if (key) {
          localStorage.setItem(`api_key_${id}`, key);
        } else {
          localStorage.removeItem(`api_key_${id}`);
        }
      }
    });

    // Update provider settings
    const updatedProviders = providers.map(p => ({
      ...p,
      name: providerSettings[p.id]?.name || p.name,
      limit: providerSettings[p.id]?.limit || p.limit,
      billingLimit: providerSettings[p.id]?.billingLimit || '',
      infoUrl: providerSettings[p.id]?.infoUrl || '',
      linkText: providerSettings[p.id]?.linkText || '',
      resetPeriod: providerSettings[p.id]?.resetPeriod || 'monthly',
      subscriptionTier: providerSettings[p.id]?.subscriptionTier || '',
    }));
    setProviders(updatedProviders);

    onClose();
  };

  const handleAddFromPreset = (presetKey) => {
    const preset = PROVIDER_PRESETS[presetKey];
    if (!preset) return;

    const id = presetKey;

    // Check if already exists
    if (providers.find(p => p.id === id)) {
      alert(`${preset.name} is already configured`);
      return;
    }

    const newProvider = {
      id,
      name: preset.name,
      limit: preset.limit,
      billingLimit: '',
      color: preset.color,
      infoUrl: preset.infoUrl || '',
      linkText: preset.linkText || '',
      resetPeriod: preset.resetPeriod || 'monthly',
      subscriptionTier: '',
    };

    setProviders([...providers, newProvider]);
    setProviderSettings({
      ...providerSettings,
      [id]: {
        name: newProvider.name,
        limit: newProvider.limit,
        billingLimit: '',
        infoUrl: newProvider.infoUrl,
        linkText: newProvider.linkText,
        resetPeriod: newProvider.resetPeriod,
        subscriptionTier: '',
      }
    });
    setKeys({ ...keys, [id]: '' });
    setShowPresets(false);
  };

  const handleAddApi = (e) => {
    e.preventDefault();
    if (!newApi.name) return;

    const id = newApi.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const colorIndex = providers.length % COLORS.length;

    const newProvider = {
      id,
      name: newApi.name,
      limit: parseInt(newApi.limit) || 1000,
      billingLimit: newApi.billingLimit ? parseFloat(newApi.billingLimit) : '',
      color: COLORS[colorIndex],
      infoUrl: newApi.infoUrl || '',
      linkText: newApi.linkText || '',
      resetPeriod: newApi.resetPeriod || 'monthly',
      subscriptionTier: newApi.subscriptionTier || '',
    };

    setProviders([...providers, newProvider]);
    setProviderSettings({
      ...providerSettings,
      [id]: {
        name: newProvider.name,
        limit: newProvider.limit,
        billingLimit: newProvider.billingLimit,
        infoUrl: newProvider.infoUrl,
        linkText: newProvider.linkText,
        resetPeriod: newProvider.resetPeriod,
        subscriptionTier: newProvider.subscriptionTier,
      }
    });
    setKeys({ ...keys, [id]: '' });
    setNewApi({
      name: '',
      limit: 1000,
      billingLimit: '',
      infoUrl: '',
      linkText: '',
      resetPeriod: 'monthly',
      subscriptionTier: ''
    });
    setShowAddForm(false);
  };

  const handleDeleteApi = (id) => {
    if (confirm(`Delete ${providers.find(p => p.id === id)?.name}?`)) {
      setProviders(providers.filter(p => p.id !== id));
      localStorage.removeItem(`api_key_${id}`);
      localStorage.removeItem(`api_admin_key_${id}`);
      const newKeys = { ...keys };
      delete newKeys[id];
      delete newKeys[`${id}_admin`];
      setKeys(newKeys);
      const newSettings = { ...providerSettings };
      delete newSettings[id];
      setProviderSettings(newSettings);
    }
  };

  const updateProviderSetting = (id, field, value) => {
    setProviderSettings({
      ...providerSettings,
      [id]: {
        ...providerSettings[id],
        [field]: value,
      }
    });
  };

  const testApiKey = async (providerId, providerName) => {
    const apiKey = keys[providerId];
    if (!apiKey) {
      setTestResults({ ...testResults, [providerId]: { valid: false, message: 'Please enter an API key first' } });
      return;
    }

    setTestingKey(providerId);
    setTestResults({ ...testResults, [providerId]: null });

    try {
      const res = await fetch('/.netlify/functions/test-api-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: providerName, apiKey }),
      });

      const data = await res.json();
      setTestResults({ ...testResults, [providerId]: data });

      // Auto-populate fields if we got data
      if (data.valid) {
        if (data.limit) {
          updateProviderSetting(providerId, 'limit', data.limit);
        }
        if (data.resetPeriod) {
          updateProviderSetting(providerId, 'resetPeriod', data.resetPeriod);
        }
        if (data.subscriptionTier) {
          updateProviderSetting(providerId, 'subscriptionTier', data.subscriptionTier);
        }
      }
    } catch (error) {
      setTestResults({ ...testResults, [providerId]: { valid: false, message: 'Failed to test key' } });
    } finally {
      setTestingKey(null);
    }
  };

  if (!isOpen) return null;

  // Get available presets (not yet added)
  const availablePresets = Object.entries(PROVIDER_PRESETS).filter(
    ([key]) => !providers.find(p => p.id === key)
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b">
          <h2 className="text-xl font-bold">Settings</h2>
          <p className="text-sm text-gray-600 mt-1">
            Manage your API providers and keys
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {providers.length === 0 && !showAddForm && !showPresets ? (
            <div className="text-center py-8">
              <p className="text-gray-500 mb-4">No API providers configured yet.</p>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => setShowPresets(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                >
                  Quick Add Popular API
                </button>
                <button
                  onClick={() => setShowAddForm(true)}
                  className="text-blue-600 hover:text-blue-800"
                >
                  Or add custom provider
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Provider Presets */}
              {showPresets && availablePresets.length > 0 && (
                <div className="border-2 border-dashed border-blue-300 rounded-lg p-4 bg-blue-50">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-medium">Quick Add Provider</h3>
                    <button
                      onClick={() => setShowPresets(false)}
                      className="text-gray-500 hover:text-gray-700 text-xl leading-none"
                    >
                      &times;
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {availablePresets.map(([key, preset]) => (
                      <button
                        key={key}
                        onClick={() => handleAddFromPreset(key)}
                        className="flex items-center gap-2 p-2 bg-white border rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors text-left"
                      >
                        <ProviderBadge provider={preset.name} size="sm" />
                        <div className="min-w-0">
                          <div className="font-medium text-sm">{preset.name}</div>
                          <div className="text-xs text-gray-500 truncate">
                            {preset.resetPeriod === 'per-minute' ? 'Per-minute' : preset.resetPeriod === 'hourly' ? 'Hourly' : 'Monthly'} reset
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Existing Providers */}
              {providers.map(provider => (
                <div key={provider.id} className="border rounded-lg p-4 bg-gray-50">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 flex-1">
                      <ProviderBadge provider={provider.name} size="sm" />
                      <input
                        type="text"
                        value={providerSettings[provider.id]?.name || provider.name}
                        onChange={(e) => updateProviderSetting(provider.id, 'name', e.target.value)}
                        className="font-medium bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none px-1 py-0.5"
                      />
                      {providerSettings[provider.id]?.subscriptionTier && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                          {providerSettings[provider.id].subscriptionTier}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteApi(provider.id)}
                      className="text-red-500 hover:text-red-700 text-sm"
                    >
                      Delete
                    </button>
                  </div>

                  {/* API Key */}
                  <div className="mb-3">
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      API Key
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        value={keys[provider.id] || ''}
                        onChange={(e) => setKeys({ ...keys, [provider.id]: e.target.value })}
                        className="flex-1 p-2 border rounded text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        placeholder="sk-..."
                      />
                      <button
                        type="button"
                        onClick={() => testApiKey(provider.id, provider.name)}
                        disabled={!keys[provider.id] || testingKey === provider.id}
                        className={`px-3 py-2 rounded text-sm font-medium whitespace-nowrap ${
                          !keys[provider.id]
                            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            : testingKey === provider.id
                            ? 'bg-blue-100 text-blue-600'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                      >
                        {testingKey === provider.id ? (
                          <span className="flex items-center gap-1">
                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                            </svg>
                            Testing...
                          </span>
                        ) : 'Test & Fetch'}
                      </button>
                    </div>
                  </div>

                  {/* Admin Key (for OpenAI) */}
                  {(provider.id === 'openai' || PROVIDER_PRESETS[provider.id]?.hasAdminKey) && (
                    <div className="mb-3">
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        Admin Key <span className="text-gray-400">(for usage tracking)</span>
                      </label>
                      <input
                        type="password"
                        value={keys[`${provider.id}_admin`] || ''}
                        onChange={(e) => setKeys({ ...keys, [`${provider.id}_admin`]: e.target.value })}
                        className="w-full p-2 border rounded text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        placeholder="sk-admin-..."
                      />
                      <p className="text-xs text-gray-400 mt-1">
                        Required for detailed usage data. Get from Settings &rarr; Organization &rarr; Admin Keys
                      </p>
                    </div>
                  )}

                  {/* Test Results */}
                  {testResults[provider.id] && (
                    <div className={`mb-3 p-3 rounded-lg text-sm ${
                      testResults[provider.id].valid
                        ? 'bg-green-50 border border-green-200'
                        : 'bg-red-50 border border-red-200'
                    }`}>
                      <div className="flex items-center gap-2 mb-2">
                        {testResults[provider.id].valid ? (
                          <span className="text-green-600 font-medium">Valid</span>
                        ) : (
                          <span className="text-red-600 font-medium">Invalid</span>
                        )}
                        {testResults[provider.id].subscriptionTier && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                            {testResults[provider.id].subscriptionTier}
                          </span>
                        )}
                      </div>
                      {testResults[provider.id].valid && (
                        <div className="text-gray-600 space-y-1">
                          {testResults[provider.id].limit && (
                            <p>Limit: <strong>{testResults[provider.id].limit.toLocaleString()}</strong></p>
                          )}
                          {testResults[provider.id].usage !== undefined && testResults[provider.id].usage !== null && (
                            <p>Usage: <strong>{testResults[provider.id].usage.toLocaleString()}</strong></p>
                          )}
                          {testResults[provider.id].resetPeriod && (
                            <p>Reset: <strong>{testResults[provider.id].resetPeriod}</strong></p>
                          )}
                          {testResults[provider.id].resetInfo && (
                            <p className="text-xs">{testResults[provider.id].resetInfo}</p>
                          )}
                          {/* Extended rate limit info */}
                          {testResults[provider.id].rateLimits?.inputTokens?.limit && (
                            <p className="text-xs">
                              Input Tokens: {testResults[provider.id].rateLimits.inputTokens.remaining?.toLocaleString() || '?'} / {testResults[provider.id].rateLimits.inputTokens.limit.toLocaleString()}
                            </p>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              if (testResults[provider.id].limit) {
                                updateProviderSetting(provider.id, 'limit', testResults[provider.id].limit);
                              }
                              if (testResults[provider.id].resetPeriod) {
                                updateProviderSetting(provider.id, 'resetPeriod', testResults[provider.id].resetPeriod);
                              }
                              if (testResults[provider.id].subscriptionTier) {
                                updateProviderSetting(provider.id, 'subscriptionTier', testResults[provider.id].subscriptionTier);
                              }
                            }}
                            className="mt-2 text-blue-600 hover:text-blue-800 font-medium"
                          >
                            Apply these values
                          </button>
                        </div>
                      )}
                      {testResults[provider.id].message && (
                        <p className="text-gray-500 mt-1">
                          {testResults[provider.id].message}
                          {testResults[provider.id].dashboardUrl && (
                            <a
                              href={testResults[provider.id].dashboardUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="ml-2 text-blue-600 hover:text-blue-800 underline"
                            >
                              View Dashboard
                            </a>
                          )}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Settings Grid */}
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    {/* Limit */}
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        Usage Limit
                      </label>
                      <input
                        type="number"
                        value={providerSettings[provider.id]?.limit || provider.limit}
                        onChange={(e) => updateProviderSetting(provider.id, 'limit', parseInt(e.target.value) || 0)}
                        className="w-full p-2 border rounded text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>

                    {/* Reset Period */}
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        Reset Period
                      </label>
                      <select
                        value={providerSettings[provider.id]?.resetPeriod || 'monthly'}
                        onChange={(e) => updateProviderSetting(provider.id, 'resetPeriod', e.target.value)}
                        className="w-full p-2 border rounded text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                      >
                        <option value="per-minute">Per Minute</option>
                        <option value="hourly">Hourly</option>
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-3">
                    {/* Billing Limit */}
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        Budget <span className="text-gray-400">($/period)</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={providerSettings[provider.id]?.billingLimit || ''}
                          onChange={(e) => updateProviderSetting(provider.id, 'billingLimit', e.target.value ? parseFloat(e.target.value) : '')}
                          className="w-full p-2 pl-7 border rounded text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          placeholder="0.00"
                        />
                      </div>
                    </div>

                    {/* Subscription Tier */}
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        Tier
                      </label>
                      <input
                        type="text"
                        value={providerSettings[provider.id]?.subscriptionTier || ''}
                        onChange={(e) => updateProviderSetting(provider.id, 'subscriptionTier', e.target.value)}
                        className="w-full p-2 border rounded text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        placeholder="Pro, Free, Tier 1..."
                      />
                    </div>
                  </div>

                  {/* Info URL */}
                  <div className="mb-3">
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Dashboard URL
                    </label>
                    <input
                      type="url"
                      value={providerSettings[provider.id]?.infoUrl || ''}
                      onChange={(e) => updateProviderSetting(provider.id, 'infoUrl', e.target.value)}
                      className="w-full p-2 border rounded text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      placeholder="https://..."
                    />
                  </div>

                  {/* Link Text */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Link Text
                    </label>
                    <input
                      type="text"
                      value={providerSettings[provider.id]?.linkText || ''}
                      onChange={(e) => updateProviderSetting(provider.id, 'linkText', e.target.value)}
                      className="w-full p-2 border rounded text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      placeholder="View Dashboard"
                    />
                  </div>
                </div>
              ))}

              {/* Add New API Form */}
              {showAddForm ? (
                <div className="border-2 border-dashed border-blue-300 rounded-lg p-4 bg-blue-50">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-medium">Add Custom Provider</h3>
                    <button
                      onClick={() => setShowAddForm(false)}
                      className="text-gray-500 hover:text-gray-700 text-xl leading-none"
                    >
                      &times;
                    </button>
                  </div>
                  <form onSubmit={handleAddApi}>
                    <div className="mb-3">
                      <label className="block text-xs font-medium text-gray-500 mb-1">Name *</label>
                      <input
                        type="text"
                        value={newApi.name}
                        onChange={(e) => setNewApi({ ...newApi, name: e.target.value })}
                        className="w-full p-2 border rounded text-sm"
                        placeholder="e.g. Custom API"
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Usage Limit</label>
                        <input
                          type="number"
                          value={newApi.limit}
                          onChange={(e) => setNewApi({ ...newApi, limit: e.target.value })}
                          className="w-full p-2 border rounded text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Reset Period</label>
                        <select
                          value={newApi.resetPeriod || 'monthly'}
                          onChange={(e) => setNewApi({ ...newApi, resetPeriod: e.target.value })}
                          className="w-full p-2 border rounded text-sm bg-white"
                        >
                          <option value="per-minute">Per Minute</option>
                          <option value="hourly">Hourly</option>
                          <option value="daily">Daily</option>
                          <option value="weekly">Weekly</option>
                          <option value="monthly">Monthly</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Budget ($)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={newApi.billingLimit}
                          onChange={(e) => setNewApi({ ...newApi, billingLimit: e.target.value })}
                          className="w-full p-2 border rounded text-sm"
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Tier</label>
                        <input
                          type="text"
                          value={newApi.subscriptionTier}
                          onChange={(e) => setNewApi({ ...newApi, subscriptionTier: e.target.value })}
                          className="w-full p-2 border rounded text-sm"
                          placeholder="Free, Pro..."
                        />
                      </div>
                    </div>
                    <div className="mb-3">
                      <label className="block text-xs font-medium text-gray-500 mb-1">Dashboard URL</label>
                      <input
                        type="url"
                        value={newApi.infoUrl}
                        onChange={(e) => setNewApi({ ...newApi, infoUrl: e.target.value })}
                        className="w-full p-2 border rounded text-sm"
                        placeholder="https://..."
                      />
                    </div>
                    <div className="flex gap-2">
                      <button type="submit" className="bg-green-600 text-white px-3 py-1.5 rounded text-sm hover:bg-green-700">
                        Add
                      </button>
                      <button type="button" onClick={() => setShowAddForm(false)} className="bg-gray-400 text-white px-3 py-1.5 rounded text-sm hover:bg-gray-500">
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                <div className="flex gap-2">
                  {availablePresets.length > 0 && (
                    <button
                      onClick={() => setShowPresets(!showPresets)}
                      className="flex-1 border-2 border-dashed border-blue-300 rounded-lg p-3 text-blue-600 hover:border-blue-400 hover:bg-blue-50 transition-colors text-sm"
                    >
                      + Quick Add
                    </button>
                  )}
                  <button
                    onClick={() => setShowAddForm(true)}
                    className="flex-1 border-2 border-dashed border-gray-300 rounded-lg p-3 text-gray-500 hover:border-gray-400 hover:text-gray-600 transition-colors text-sm"
                  >
                    + Custom Provider
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-6 border-t bg-gray-50 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
