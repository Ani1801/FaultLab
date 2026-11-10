import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert, Eye, EyeOff, AlertCircle, ArrowRight, Loader2, Check, X } from 'lucide-react';

export const RegisterPage: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, error: authError, clearError } = useAuth();
  const navigate = useNavigate();

  // Password requirement checks
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const passwordsMatch = password.length > 0 && password === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    clearError();

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName || trimmedName.length < 2) {
      setValidationError('Name must be at least 2 characters');
      return;
    }

    if (!trimmedEmail) {
      setValidationError('Email address is required');
      return;
    }

    if (!hasMinLength || !hasUppercase || !hasLowercase || !hasNumber) {
      setValidationError('Please meet all password security requirements');
      return;
    }

    if (password !== confirmPassword) {
      setValidationError('Passwords do not match');
      return;
    }

    setIsSubmitting(true);
    try {
      await register({ name: trimmedName, email: trimmedEmail, password });
      navigate('/dashboard', { replace: true });
    } catch {
      // Error state is captured and provided by AuthContext
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeError = validationError || authError;

  return (
    <div className="max-w-md w-full mx-auto my-10">
      {/* Brand Header */}
      <div className="text-center mb-6">
        <div className="inline-flex h-11 w-11 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 items-center justify-center text-white shadow-lg shadow-sky-500/20 mb-3">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Create your FaultLab account</h1>
        <p className="text-sm text-slate-400 mt-1">Start modeling and injecting simulated API failures</p>
      </div>

      {/* Main Registration Card */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-7 shadow-2xl relative">
        {activeError && (
          <div className="mb-5 p-3.5 rounded-lg bg-rose-950/40 border border-rose-900/60 flex items-start space-x-2.5 text-xs text-rose-300">
            <AlertCircle className="h-4 w-4 text-rose-400 flex-shrink-0 mt-0.5" />
            <span className="leading-relaxed">{activeError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-xs font-medium text-slate-300 mb-1.5">
              Full name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (validationError) setValidationError(null);
              }}
              autoComplete="name"
              required
              disabled={isSubmitting}
              placeholder="Jane Developer"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500 transition-all disabled:opacity-50"
            />
          </div>

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
              placeholder="jane@company.com"
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
                autoComplete="new-password"
                required
                disabled={isSubmitting}
                placeholder="At least 8 characters"
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

            {/* Password Criteria Feedback */}
            {password.length > 0 && (
              <div className="mt-2.5 p-3 rounded-lg bg-slate-950/80 border border-slate-850 grid grid-cols-2 gap-2 text-[11px] font-mono">
                <div className={`flex items-center space-x-1.5 ${hasMinLength ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {hasMinLength ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                  <span>8+ characters</span>
                </div>
                <div className={`flex items-center space-x-1.5 ${hasUppercase ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {hasUppercase ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                  <span>1 uppercase letter</span>
                </div>
                <div className={`flex items-center space-x-1.5 ${hasLowercase ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {hasLowercase ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                  <span>1 lowercase letter</span>
                </div>
                <div className={`flex items-center space-x-1.5 ${hasNumber ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {hasNumber ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                  <span>1 number</span>
                </div>
              </div>
            )}
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-xs font-medium text-slate-300 mb-1.5">
              Confirm password
            </label>
            <div className="relative">
              <input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (validationError) setValidationError(null);
                }}
                autoComplete="new-password"
                required
                disabled={isSubmitting}
                placeholder="Re-enter password"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-3.5 pr-10 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500 transition-all disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                tabIndex={-1}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors p-1"
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {confirmPassword.length > 0 && !passwordsMatch && (
              <p className="text-[11px] text-rose-400 mt-1">Passwords do not match</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-2 inline-flex items-center justify-center space-x-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-medium text-sm py-2.5 px-4 transition-colors shadow-lg shadow-sky-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Creating account...</span>
              </>
            ) : (
              <>
                <span>Create account</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-slate-800/80 text-center text-xs text-slate-400">
          Already have an account?{' '}
          <Link
            to="/login"
            className="text-sky-400 hover:text-sky-300 font-medium transition-colors inline-flex items-center space-x-0.5"
          >
            <span>Sign in</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

