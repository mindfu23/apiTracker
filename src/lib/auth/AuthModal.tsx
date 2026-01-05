/**
 * Reusable Auth Modal Component
 * 
 * A configurable login/signup modal that works with the AuthContext.
 * Customize appearance via AuthModalConfig.
 */

import React, { useState } from 'react';
import { useAuth } from './AuthContext';

export interface AuthModalConfig {
  /** Title for login mode (default: 'Welcome Back!') */
  loginTitle?: string;
  /** Title for signup mode (default: 'Create Account') */
  signupTitle?: string;
  /** Description for login mode */
  loginDescription?: string;
  /** Description for signup mode */
  signupDescription?: string;
  /** Primary button color (default: '#f3c053') */
  primaryColor?: string;
  /** Primary button hover color (default: '#e5b347') */
  primaryHoverColor?: string;
  /** Primary button text color (default: 'black') */
  primaryTextColor?: string;
  /** Minimum password length (default: 8) */
  minPasswordLength?: number;
}

const DEFAULT_MODAL_CONFIG: Required<AuthModalConfig> = {
  loginTitle: 'Welcome Back!',
  signupTitle: 'Create Account',
  loginDescription: 'Sign in to save your work and sync across devices',
  signupDescription: 'Sign up to save and sync your data',
  primaryColor: '#f3c053',
  primaryHoverColor: '#e5b347',
  primaryTextColor: 'black',
  minPasswordLength: 8,
};

interface AuthModalProps {
  config?: AuthModalConfig;
}

export function AuthModal({ config: userConfig }: AuthModalProps = {}): JSX.Element | null {
  const modalConfig = { ...DEFAULT_MODAL_CONFIG, ...userConfig };
  
  const {
    showAuthModal,
    setShowAuthModal,
    authModalMode,
    setAuthModalMode,
    login,
    signup,
    requestPasswordReset,
  } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const isLogin = authModalMode === 'login';
  const isSignup = authModalMode === 'signup';
  const isForgotPassword = authModalMode === 'forgot-password';

  if (!showAuthModal) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    // Validation
    if (!email) {
      setError('Please enter your email');
      return;
    }

    if (isForgotPassword) {
      setIsSubmitting(true);
      try {
        const result = await requestPasswordReset(email);
        if (!result.success) {
          setError(result.error || 'An error occurred');
        } else {
          setSuccessMessage('If an account exists with this email, you will receive a password reset link shortly.');
        }
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (!password) {
      setError('Please fill in all required fields');
      return;
    }

    if (isSignup) {
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }
      if (password.length < modalConfig.minPasswordLength) {
        setError(`Password must be at least ${modalConfig.minPasswordLength} characters`);
        return;
      }
      if (!displayName.trim()) {
        setError('Please enter your name');
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const result = isLogin
        ? await login(email, password)
        : await signup(email, password, displayName);

      if (!result.success) {
        setError(result.error || 'An error occurred');
      } else {
        // Clear form on success
        clearForm();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const switchMode = (mode: 'login' | 'signup' | 'forgot-password') => {
    setAuthModalMode(mode);
    setError('');
    setSuccessMessage('');
  };

  const clearForm = () => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setDisplayName('');
    setError('');
    setSuccessMessage('');
  };

  const handleClose = () => {
    setShowAuthModal(false);
    clearForm();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {isLogin && modalConfig.loginTitle}
                {isSignup && modalConfig.signupTitle}
                {isForgotPassword && 'Reset Password'}
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {isLogin && modalConfig.loginDescription}
                {isSignup && modalConfig.signupDescription}
                {isForgotPassword && 'Enter your email to receive a reset link'}
              </p>
            </div>
            <button 
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-500 focus:outline-none"
            >
              <span className="sr-only">Close</span>
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignup && (
              <div className="space-y-2">
                <label htmlFor="displayName" className="block text-sm font-medium text-gray-700">Name</label>
                <input
                  id="displayName"
                  type="text"
                  placeholder="Your name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting}
                autoComplete="email"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {!isForgotPassword && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</label>
                  {isLogin && (
                    <button
                      type="button"
                      onClick={() => switchMode('forgot-password')}
                      className="text-xs hover:underline"
                      style={{ color: modalConfig.primaryColor }}
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder={isLogin ? 'Your password' : `At least ${modalConfig.minPasswordLength} characters`}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isSubmitting}
                    autoComplete={isLogin ? 'current-password' : 'new-password'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showPassword ? (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            )}

            {isSignup && (
              <div className="space-y-2">
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">Confirm Password</label>
                <input
                  id="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isSubmitting}
                  autoComplete="new-password"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            )}

            {error && (
              <div className="p-3 rounded-md bg-red-50 text-red-600 text-sm">
                {error}
              </div>
            )}

            {successMessage && (
              <div className="p-3 rounded-md bg-green-50 text-green-600 text-sm">
                {successMessage}
              </div>
            )}

            <button
              type="submit"
              className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              style={{ 
                backgroundColor: modalConfig.primaryColor,
                color: modalConfig.primaryTextColor,
              }}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </span>
              ) : (
                isLogin ? 'Sign In' : isSignup ? 'Create Account' : 'Send Reset Link'
              )}
            </button>

            <div className="text-center text-sm text-gray-600">
              {isLogin ? (
                <>
                  Don't have an account?{' '}
                  <button
                    type="button"
                    onClick={() => switchMode('signup')}
                    className="font-semibold hover:underline"
                    style={{ color: modalConfig.primaryColor }}
                  >
                    Sign up
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => switchMode('login')}
                    className="font-semibold hover:underline"
                    style={{ color: modalConfig.primaryColor }}
                  >
                    Sign in
                  </button>
                </>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
