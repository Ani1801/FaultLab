import React, { createContext, useContext, useMemo } from 'react';

interface AppContextValue {
  appName: string;
  version: string;
  phase: string;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const value = useMemo<AppContextValue>(
    () => ({
      appName: 'FaultLab',
      version: '1.0.0',
      phase: 'Phase 1: Foundations',
    }),
    []
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = (): AppContextValue => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

