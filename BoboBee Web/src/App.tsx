import React from 'react';
import { AppProviders } from './app/AppProviders';
import { Router } from './app/Router';

function App() {
  return (
    <AppProviders>
      <div className="min-h-screen bg-gray-50">
        <Router />
      </div>
    </AppProviders>
  );
}

export default App;