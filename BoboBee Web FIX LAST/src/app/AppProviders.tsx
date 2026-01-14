import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '../state/stores/useAuthStore';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

interface AppProvidersProps {
  children: React.ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  const { setUser, setLoading } = useAuthStore();

  React.useEffect(() => {
    // Check for existing authentication on app start
    const token = localStorage.getItem('auth_token');
    
    if (token) {
      // In a real app, validate token with backend
      setUser({
        id: 'user123',
        email: 'demo@bobobee.com',
        roles: ['OWNER'],
      });
    }
    
    setLoading(false);
  }, [setUser, setLoading]);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {children}
      </BrowserRouter>
    </QueryClientProvider>
  );
}