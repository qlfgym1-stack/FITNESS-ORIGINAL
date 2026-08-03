import { Component, type ReactNode, type ErrorInfo } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  private reloadAttempted = false

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info)
    const msg = error?.message || ''
    const staleChunk =
      /Failed to fetch dynamically imported module|Importing a module script failed|Unable to preload CSS|Loading chunk .* failed|does not provide an export named/i.test(
        msg
      )
    if (staleChunk && !this.reloadAttempted) {
      this.reloadAttempted = true
      console.warn('[ErrorBoundary] Stale chunk detected, reloading app:', msg)
      window.location.reload()
    }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="flex items-center justify-center h-screen">
          <div className="text-center space-y-4">
            <div className="text-4xl">⚠️</div>
            <h1 className="text-xl font-bold">Something went wrong</h1>
            <p className="text-sm text-muted-foreground max-w-md">{this.state.error?.message}</p>
            <button
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm"
              onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload() }}
            >
              Reload page
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
