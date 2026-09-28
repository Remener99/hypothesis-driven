import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { AuthProvider } from './lib/auth';
import App from './App';
import './index.css';

// GitHub Pages has no SPA fallback → use hash routing in the static build
const Router = import.meta.env.VITE_STATIC ? HashRouter : BrowserRouter;

const qc = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: (n, e) => e?.status !== 401 && e?.status !== 404 && n < 2 } } });

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={qc}>
      <Router>
        <AuthProvider>
          <App />
          <Toaster position="bottom-right" richColors closeButton toastOptions={{ style: { fontFamily: 'inherit' } }} />
        </AuthProvider>
      </Router>
    </QueryClientProvider>
  </React.StrictMode>,
);
