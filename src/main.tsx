import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import { ThemeProvider } from '@/stores/theme'
import { I18nProvider } from '@/i18n'
import { OfflineQueueProvider } from '@/stores/offline-queue'
import { OfflineBanner } from '@/components/ui/offline-banner'
import { Toaster } from '@/components/ui/toast'
import App from './App'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      gcTime: 1000 * 60 * 60 * 24,
      retry: 1,
      networkMode: 'offlineFirst',
    },
    mutations: {
      networkMode: 'offlineFirst',
    },
  },
})

const persister = createSyncStoragePersister({
  storage: window.localStorage,
  key: 'FITMANAGER_QUERY_CACHE',
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{ persister, maxAge: 1000 * 60 * 60 * 24 }}
      >
        <ThemeProvider>
          <I18nProvider>
            <OfflineQueueProvider>
              <OfflineBanner />
              <App />
              <Toaster />
            </OfflineQueueProvider>
          </I18nProvider>
        </ThemeProvider>
      </PersistQueryClientProvider>
    </BrowserRouter>
  </React.StrictMode>
)