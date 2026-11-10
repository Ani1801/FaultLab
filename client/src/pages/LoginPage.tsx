import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert, Eye, EyeOff, AlertCircle, ArrowRight, Loader2 } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login, error: authError, clearError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Redirect to requested URL or dashboard after login
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    clearError();

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setValidationError('Email address is required');
      return;
    }

    if (!password) {
      setValidationError('Password is required');
      return;
    }

    setIsSubmitting(true);
    try {
      await login({ email: trimmedEmail, password });
      navigate(from, { replace: true });
    } catch {
      // Error state is captured and provided by AuthContext
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeError = validationError || authError;

  return (
    <div className="max-w-md w-full mx-auto my-12">
      {/* Brand Header */}
      <div className="text-center mb-8">
        <div className="inline-flex h-11 w-11 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 items-center justify-center text-white shadow-lg shadow-sky-500/20 mb-3">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Sign in to FaultLab</h1>
        <p className="text-sm text-slate-400 mt-1">Enter your credentials to access your testing workspaces</p>
      </div>

      {/* Main Form Card */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-7 shadow-2xl relative">
        {activeError && (
          <div className="mb-5 p-3.5 rounded-lg bg-rose-950/40 border border-rose-900/60 flex items-start space-x-2.5 text-xs text-rose-300">
            <AlertCircle className="h-4 w-4 text-rose-400 flex-shrink-0 mt-0.5" />
            <span className="leading-relaxed">{activeError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-xs font-medium text-slate-300 mb-1.5">
              Email address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (validationError) setValidationError(null);
              }}
              autoComplete="email"
              required
              disabled={isSubmitting}
              placeholder="developer@company.com"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500 transition-all disabled:opacity-50"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-xs font-medium text-slate-300 mb-1.5">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (validationError) setValidationError(null);
                }}
                autoComplete="current-password"
                required
                disabled={isSubmitting}
                placeholder="••••••••••••"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-3.5 pr-10 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500 transition-all disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors p-1"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-2 inline-flex items-center justify-center space-x-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-medium text-sm py-2.5 px-4 transition-colors shadow-lg shadow-sky-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Signing in...</span>
              </>
            ) : (
              <>
                <span>Sign in</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-slate-800/80 text-center text-xs text-slate-400">
          Don&apos;t have an account?{' '}
          <Link
            to="/register"
            className="text-sky-400 hover:text-sky-300 font-medium transition-colors inline-flex items-center space-x-0.5"
          >
            <span>Create one</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

