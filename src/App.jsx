import React, { useState, useEffect } from 'react';
import SettingsModal from './components/SettingsModal';
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
  }, [providers]);

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
          setProviders={setProviders}
        />
        <AuthModal />

        {providers.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📊</div>
            <h2 className="text-xl font-semibold text-gray-700 mb-2">Welcome to API Tracker!</h2>
            <p className="text-gray-500 mb-6">Get started by adding your first API provider to track.</p>
            <button
              onClick={() => setShowSettings(true)}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors text-lg"
            >
              + Add Your First API
            </button>
          </div>
        ) : (
          <>
        <div className="space-y-6">
          {providers.map(provider => {
            const usage = apiUsage[provider.id] || 0;
            const percentage = Math.min((usage / provider.limit) * 100, 100);
            
            return (
              <div key={provider.id} className="w-full">
                <div className="flex justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-medium text-gray-700">{provider.name}</span>
                    {provider.infoUrl && (
                      <a
                        href={provider.infoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-500 hover:text-blue-700 hover:underline"
                      >
                        {provider.linkText || provider.infoUrl}
                      </a>
                    )}
                  </div>
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
          <button 
            onClick={() => setShowSettings(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
          >
            Manage API Providers
          </button>
        </div>
          </>
        )}
      </div>
    </div>
  );
}

export default App;
