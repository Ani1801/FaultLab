import React from 'react';
import { AppProvider } from './context/AppContext';
import { RootLayout } from './layouts/RootLayout';
import { HomePage } from './pages/HomePage';

export const App: React.FC = () => {
  return (
    <AppProvider>
      <RootLayout>
        <HomePage />
      </RootLayout>
    </AppProvider>
  );
};

export default App;

