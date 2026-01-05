import React, { useState, useEffect } from 'react';

export default function SettingsModal({ isOpen, onClose, providers }) {
  const [keys, setKeys] = useState({});

  useEffect(() => {
    if (isOpen) {
      const loadedKeys = {};
      providers.forEach(p => {
        loadedKeys[p.id] = localStorage.getItem(`api_key_${p.id}`) || '';
      });
      setKeys(loadedKeys);
    }
  }, [isOpen, providers]);

  const handleSave = () => {
    Object.entries(keys).forEach(([id, key]) => {
      if (key) {
        localStorage.setItem(`api_key_${id}`, key);
      } else {
        localStorage.removeItem(`api_key_${id}`);
      }
    });
    onClose();
    window.location.reload(); // Reload to trigger new fetch with keys
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96 max-h-[80vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">Configure API Keys</h2>
        <p className="text-sm text-gray-600 mb-4">
          Enter your personal API keys to track usage directly from your device. 
          These are stored locally in your browser/app.
        </p>
        
        <div className="space-y-4">
          {providers.map(provider => (
            <div key={provider.id}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {provider.name} API Key
              </label>
              <input
                type="password"
                value={keys[provider.id] || ''}
                onChange={(e) => setKeys({...keys, [provider.id]: e.target.value})}
                className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
                placeholder={`sk-...`}
              />
            </div>
          ))}
        </div>

        <div className="mt-6 flex justify-end space-x-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Save Keys
          </button>
        </div>
      </div>
    </div>
  );
}
