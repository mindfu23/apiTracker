import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.apitracker.app',
  appName: 'API Tracker',
  webDir: 'www',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    // Preferences plugin for cross-platform storage
    Preferences: {
      // No additional config needed
    },
    // Browser plugin for in-app WebView
    Browser: {
      // No additional config needed
    }
  },
  ios: {
    contentInset: 'automatic',
    backgroundColor: '#f9fafb'
  },
  android: {
    backgroundColor: '#f9fafb'
  }
};

export default config;
