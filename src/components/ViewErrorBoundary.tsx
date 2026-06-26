'use client'

import React, { Component, ReactNode } from 'react'
import { AlertTriangle, RotateCcw, Home } from 'lucide-react'

interface Props {
  children: ReactNode
  viewName?: string
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * Client-side error boundary that catches rendering errors per-view.
 * Allows the user to retry or go back to dashboard instead of seeing
 * the full-page Next.js error overlay.
 */
export class ViewErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`[ViewErrorBoundary] Error in "${this.props.viewName || 'unknown'}" view:`, error)
    console.error('[ViewErrorBoundary] Component stack:', errorInfo.componentStack)
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  private handleGoHome = () => {
    // Clear any potentially corrupted localStorage
    try {
      localStorage.removeItem('isecurify-quote-builder')
    } catch { /* ignore */ }
    this.setState({ hasError: false, error: null })
    // Dispatch a custom event that the AppContent can listen to
    window.dispatchEvent(new CustomEvent('navigate-home'))
  }

  private handleClearAndReset = () => {
    try {
      localStorage.removeItem('isecurify-quote-builder')
      localStorage.removeItem('isecurify-auth')
    } catch { /* ignore */ }
    window.location.href = '/'
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-[60vh] p-4">
          <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50">
              <AlertTriangle className="h-6 w-6 text-amber-500" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 mb-1">
              Error loading {this.props.viewName || 'page'}
            </h3>
            <p className="text-xs text-slate-500 mb-1">
              An unexpected error occurred. This might be due to stale cached data.
            </p>
            {this.state.error?.message && (
              <p className="text-[11px] text-slate-400 font-mono mb-4 break-all bg-slate-50 rounded p-2">
                {this.state.error.message}
              </p>
            )}
            <div className="flex flex-col gap-2">
              <button
                onClick={this.handleReset}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Try Again
              </button>
              <button
                onClick={this.handleGoHome}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <Home className="h-3.5 w-3.5" /> Go to Dashboard
              </button>
              <button
                onClick={this.handleClearAndReset}
                className="text-xs text-slate-400 hover:text-rose-600 transition-colors mt-1"
              >
                Clear cache & reload
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

/**
 * HOC that wraps a component in a ViewErrorBoundary.
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  viewName: string,
) {
  return function WrappedComponent(props: P) {
    return (
      <ViewErrorBoundary viewName={viewName}>
        <Component {...props} />
      </ViewErrorBoundary>
    )
  }
}