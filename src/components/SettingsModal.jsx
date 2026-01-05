import React, { useState, useEffect } from 'react';

const COLORS = [
  'bg-green-500', 'bg-purple-500', 'bg-blue-500', 'bg-yellow-500', 
  'bg-orange-500', 'bg-red-500', 'bg-pink-500', 'bg-indigo-500', 
  'bg-teal-500', 'bg-cyan-500'
];

export default function SettingsModal({ isOpen, onClose, providers, setProviders }) {
  const [keys, setKeys] = useState({});
  const [providerSettings, setProviderSettings] = useState({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [newApi, setNewApi] = useState({ name: '', limit: 1000, infoUrl: '', linkText: '' });

  useEffect(() => {
    if (isOpen) {
      const loadedKeys = {};
      const loadedSettings = {};
      providers.forEach(p => {
        loadedKeys[p.id] = localStorage.getItem(`api_key_${p.id}`) || '';
        loadedSettings[p.id] = {
          limit: p.limit,
          infoUrl: p.infoUrl || '',
          linkText: p.linkText || '',
        };
      });
      setKeys(loadedKeys);
      setProviderSettings(loadedSettings);
    }
  }, [isOpen, providers]);

  const handleSave = () => {
    // Save API keys to localStorage
    Object.entries(keys).forEach(([id, key]) => {
      if (key) {
        localStorage.setItem(`api_key_${id}`, key);
      } else {
        localStorage.removeItem(`api_key_${id}`);
      }
    });

    // Update provider settings (limit, URLs)
    const updatedProviders = providers.map(p => ({
      ...p,
      limit: providerSettings[p.id]?.limit || p.limit,
      infoUrl: providerSettings[p.id]?.infoUrl || '',
      linkText: providerSettings[p.id]?.linkText || '',
    }));
    setProviders(updatedProviders);

    onClose();
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
      color: COLORS[colorIndex],
      infoUrl: newApi.infoUrl || '',
      linkText: newApi.linkText || '',
    };

    setProviders([...providers, newProvider]);
    setProviderSettings({
      ...providerSettings,
      [id]: { limit: newProvider.limit, infoUrl: newProvider.infoUrl, linkText: newProvider.linkText }
    });
    setKeys({ ...keys, [id]: '' });
    setNewApi({ name: '', limit: 1000, infoUrl: '', linkText: '' });
    setShowAddForm(false);
  };

  const handleDeleteApi = (id) => {
    if (confirm(`Delete ${providers.find(p => p.id === id)?.name}?`)) {
      setProviders(providers.filter(p => p.id !== id));
      localStorage.removeItem(`api_key_${id}`);
      const newKeys = { ...keys };
      delete newKeys[id];
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

  if (!isOpen) return null;

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
          {providers.length === 0 && !showAddForm ? (
            <div className="text-center py-8">
              <p className="text-gray-500 mb-4">No API providers configured yet.</p>
              <button
                onClick={() => setShowAddForm(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                + Add Your First API
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {providers.map(provider => (
                <div key={provider.id} className="border rounded-lg p-4 bg-gray-50">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${provider.color}`}></div>
                      <span className="font-medium">{provider.name}</span>
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
                    <input
                      type="password"
                      value={keys[provider.id] || ''}
                      onChange={(e) => setKeys({ ...keys, [provider.id]: e.target.value })}
                      className="w-full p-2 border rounded text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      placeholder="sk-..."
                    />
                  </div>

                  {/* Limit */}
                  <div className="mb-3">
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

                  {/* Info URL */}
                  <div className="mb-3">
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Info URL
                    </label>
                    <input
                      type="url"
                      value={providerSettings[provider.id]?.infoUrl || ''}
                      onChange={(e) => updateProviderSetting(provider.id, 'infoUrl', e.target.value)}
                      className="w-full p-2 border rounded text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      placeholder="https://docs.example.com/api"
                    />
                  </div>

                  {/* Link Text */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Link Text <span className="text-gray-400">(optional - defaults to URL)</span>
                    </label>
                    <input
                      type="text"
                      value={providerSettings[provider.id]?.linkText || ''}
                      onChange={(e) => updateProviderSetting(provider.id, 'linkText', e.target.value)}
                      className="w-full p-2 border rounded text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      placeholder="View Documentation"
                    />
                  </div>
                </div>
              ))}

              {/* Add New API Form */}
              {showAddForm ? (
                <div className="border-2 border-dashed border-blue-300 rounded-lg p-4 bg-blue-50">
                  <h3 className="font-medium mb-3">Add New API Provider</h3>
                  <form onSubmit={handleAddApi}>
                    <div className="mb-3">
                      <label className="block text-xs font-medium text-gray-500 mb-1">Name *</label>
                      <input
                        type="text"
                        value={newApi.name}
                        onChange={(e) => setNewApi({ ...newApi, name: e.target.value })}
                        className="w-full p-2 border rounded text-sm"
                        placeholder="e.g. Midjourney"
                        required
                      />
                    </div>
                    <div className="mb-3">
                      <label className="block text-xs font-medium text-gray-500 mb-1">Usage Limit</label>
                      <input
                        type="number"
                        value={newApi.limit}
                        onChange={(e) => setNewApi({ ...newApi, limit: e.target.value })}
                        className="w-full p-2 border rounded text-sm"
                      />
                    </div>
                    <div className="mb-3">
                      <label className="block text-xs font-medium text-gray-500 mb-1">Info URL</label>
                      <input
                        type="url"
                        value={newApi.infoUrl}
                        onChange={(e) => setNewApi({ ...newApi, infoUrl: e.target.value })}
                        className="w-full p-2 border rounded text-sm"
                        placeholder="https://docs.example.com/api"
                      />
                    </div>
                    <div className="mb-3">
                      <label className="block text-xs font-medium text-gray-500 mb-1">Link Text</label>
                      <input
                        type="text"
                        value={newApi.linkText}
                        onChange={(e) => setNewApi({ ...newApi, linkText: e.target.value })}
                        className="w-full p-2 border rounded text-sm"
                        placeholder="View Documentation"
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
                <button
                  onClick={() => setShowAddForm(true)}
                  className="w-full border-2 border-dashed border-gray-300 rounded-lg p-4 text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors"
                >
                  + Add API Provider
                </button>
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
