import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { AuthProvider } from './lib/auth'

// Auth configuration for Netlify Functions
const authConfig = {
  apiBaseUrl: '/.netlify/functions/auth',
  storageKey: 'apitracker_auth',
  sessionDays: 30,
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider config={authConfig}>
      <App />
    </AuthProvider>
  </React.StrictMode>,
)
