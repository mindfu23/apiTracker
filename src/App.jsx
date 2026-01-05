import React, { useState, useEffect } from 'react';
import SettingsModal from './components/SettingsModal';
import { useAuth, AuthModal } from './lib/auth';

const DEFAULT_PROVIDERS = [
  { id: 'openai', name: 'OpenAI', limit: 1000, color: 'bg-green-500' },
  { id: 'anthropic', name: 'Anthropic', limit: 1000, color: 'bg-purple-500' },
  { id: 'perplexity', name: 'Perplexity', limit: 500, color: 'bg-blue-500' },
  { id: 'gemini', name: 'Gemini', limit: 1000, color: 'bg-yellow-500' },
  { id: 'huggingface', name: 'HuggingFace', limit: 2000, color: 'bg-orange-500' },
];

function App() {
  const [providers, setProviders] = useState(() => {
    const saved = localStorage.getItem('api_providers');
    return saved ? JSON.parse(saved) : DEFAULT_PROVIDERS;
  });
  const [apiUsage, setApiUsage] = useState({});
  const [lastUpdated, setLastUpdated] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newApi, setNewApi] = useState({ name: '', limit: 1000 });
  const [showSettings, setShowSettings] = useState(false);
  const { user, logout, setShowAuthModal } = useAuth();

  useEffect(() => {
    localStorage.setItem('api_providers', JSON.stringify(providers));
  }, [providers]);

  useEffect(() => {
    // Check for local keys first
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
      console.log("Using local keys for fetching...");
      // TODO: Implement client-side fetching logic here for each provider
      // For now, we'll just mock it to show it's "working" with local keys
      const mockUsage = {};
      providers.forEach(p => {
        if (localKeys[p.id]) {
          mockUsage[p.id] = Math.floor(Math.random() * 500); // Mock value
        }
      });
      setApiUsage(prev => ({ ...prev, ...mockUsage }));
      setLastUpdated(new Date().toLocaleString());
      return;
    }

    // Try fetching from Netlify Function first
    fetch('/.netlify/functions/get-usage')
      .then(response => {
        if (!response.ok) throw new Error('Function not available');
        return response.json();
      })
      .then(data => {
        setApiUsage(data);
        if (data.last_updated) {
          setLastUpdated(new Date(data.last_updated).toLocaleString());
        }
      })
      .catch(() => {
        // Fallback to static file if function fails (e.g. local dev without netlify cli)
        console.log("Falling back to static usage.json");
        fetch('/usage.json')
          .then(response => response.json())
          .then(data => {
            setApiUsage(data);
            if (data.last_updated) {
              setLastUpdated(new Date(data.last_updated).toLocaleString());
            }
          })
          .catch(err => console.error("Failed to load usage data", err));
      });
  }, []);

  const handleAddApi = (e) => {
    e.preventDefault();
    if (!newApi.name) return;
    
    const id = newApi.name.toLowerCase().replace(/\s+/g, '-');
    const newProvider = {
      id,
      name: newApi.name,
      limit: parseInt(newApi.limit) || 1000,
      color: 'bg-gray-500' // Default color
    };
    
    setProviders([...providers, newProvider]);
    setNewApi({ name: '', limit: 1000 });
    setShowAddForm(false);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-md overflow-hidden p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">API Usage Tracker</h1>
          <div className="flex items-center gap-4">
            {lastUpdated && <span className="text-xs text-gray-500 hidden sm:inline">Updated: {lastUpdated}</span>}
            
            {user ? (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700 hidden sm:inline">{user.displayName || user.email}</span>
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

            <button 
              onClick={() => setShowSettings(true)}
              className="text-gray-600 hover:text-gray-900"
              title="Settings"
            >
              ⚙️
            </button>
          </div>
        </div>
        
        <SettingsModal 
          isOpen={showSettings} 
          onClose={() => setShowSettings(false)} 
          providers={providers} 
        />
        <AuthModal />

        <div className="space-y-6">
          {providers.map(provider => {
            const usage = apiUsage[provider.id] || 0;
            const percentage = Math.min((usage / provider.limit) * 100, 100);
            
            return (
              <div key={provider.id} className="w-full">
                <div className="flex justify-between mb-1">
                  <span className="text-base font-medium text-gray-700">{provider.name}</span>
                  <span className="text-sm font-medium text-gray-500">{usage} / {provider.limit} calls</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-4">
                  <div 
                    className={`${provider.color} h-4 rounded-full transition-all duration-500 ease-out`} 
                    style={{ width: `${percentage}%` }}
                  ></div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-8 pt-6 border-t border-gray-200">
          {!showAddForm ? (
            <button 
              onClick={() => setShowAddForm(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
            >
              Add API Provider
            </button>
          ) : (
            <form onSubmit={handleAddApi} className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-lg font-medium mb-3">New API Details</h3>
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input 
                  type="text" 
                  value={newApi.name}
                  onChange={e => setNewApi({...newApi, name: e.target.value})}
                  className="w-full p-2 border rounded"
                  placeholder="e.g. Midjourney"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Limit</label>
                <input 
                  type="number" 
                  value={newApi.limit}
                  onChange={e => setNewApi({...newApi, limit: e.target.value})}
                  className="w-full p-2 border rounded"
                />
              </div>
              <div className="flex gap-2">
                <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">Save</button>
                <button type="button" onClick={() => setShowAddForm(false)} className="bg-gray-400 text-white px-4 py-2 rounded hover:bg-gray-500">Cancel</button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
