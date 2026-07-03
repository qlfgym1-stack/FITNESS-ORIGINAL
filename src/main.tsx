import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@/stores/theme'
import { I18nProvider } from '@/i18n'
import { Toaster } from '@/components/ui/toast'
import App from './App'
console.log('App import value:', typeof App, App === null ? 'null' : App === undefined ? 'undefined' : App?.name || 'unnamed')
import './index.css'

const queryClient = new QueryClient()

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('=== ERROR BOUNDARY CAUGHT ===', error, info)
  }
  render() {
    if (this.state.hasError) {
      return React.createElement('div', {
        style: { color: 'red', backgroundColor: 'white', padding: '20px', fontSize: '18px' }
      }, `Error: ${this.state.error?.message}`)
    }
    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <I18nProvider>
            <ErrorBoundary>
              <App />
            </ErrorBoundary>
            <Toaster />
          </I18nProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </React.StrictMode>
)