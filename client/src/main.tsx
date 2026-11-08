import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@fontsource/fira-sans/400.css';
import '@fontsource/fira-sans/500.css';
import '@fontsource/fira-sans/600.css';
import '@fontsource/fira-sans-condensed/600.css';
import '@fontsource/fira-sans-condensed/700.css';
import '@fontsource/fira-sans-condensed/800.css';
import './index.css';
import { App } from './App';
import { AuthProvider } from './lib/auth';
import { ApiError } from './lib/api';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Повторюємо лише мережеві збої та 5xx: 4xx (немає доступу, не знайдено) повтор не виправить
      retry: (count, err) => count < 2 && !(err instanceof ApiError && err.status < 500),
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
