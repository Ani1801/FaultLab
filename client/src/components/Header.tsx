import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShieldAlert, LogOut, LayoutDashboard, UserPlus, LogIn } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const Header: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <Link to="/" className="flex items-center space-x-3 group">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-sky-500/20 group-hover:scale-105 transition-transform">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="font-bold text-xl tracking-tight text-white">FaultLab</span>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-sky-950 text-sky-400 border border-sky-800 font-mono">
              Phase 2
            </span>
          </div>
        </Link>

        {/* Navigation & Auth Controls */}
        <div className="flex items-center space-x-3">
          {isAuthenticated && user ? (
            <div className="flex items-center space-x-3">
              <Link
                to="/dashboard"
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-medium border border-slate-700 hover:border-slate-600 transition-colors"
              >
                <LayoutDashboard className="h-3.5 w-3.5 text-sky-400" />
                <span>Dashboard</span>
              </Link>

              <div className="hidden sm:flex items-center space-x-2 pl-2 pr-3 py-1 rounded-lg bg-slate-950/80 border border-slate-800 text-xs">
                <div className="h-5 w-5 rounded-full bg-sky-950 text-sky-300 font-mono text-[10px] flex items-center justify-center font-bold border border-sky-800">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <span className="text-slate-300 font-medium">{user.name}</span>
              </div>

              <button
                onClick={handleLogout}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 text-xs font-medium transition-colors border border-transparent hover:border-slate-700"
                title="Sign out of your account"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <Link
                to="/login"
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/80 text-xs font-medium transition-colors"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span>Sign In</span>
              </Link>
              <Link
                to="/register"
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium shadow-md shadow-sky-600/20 transition-colors"
              >
                <UserPlus className="h-3.5 w-3.5" />
                <span>Get Started</span>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
