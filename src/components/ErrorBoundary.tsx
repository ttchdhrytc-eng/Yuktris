import { Component, type ReactNode, type ErrorInfo } from 'react';
import { AlertTriangle } from 'lucide-react';

type Props = { children: ReactNode };
type State = { hasError: boolean; error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error.message, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 p-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-error-500/10 border border-error-500/20">
            <AlertTriangle className="h-6 w-6 text-error-400" />
          </div>
          <div className="text-center">
            <h2 className="text-lg font-semibold text-ink-50 mb-1">Something went wrong</h2>
            <p className="text-sm text-ink-400 max-w-md">
              {this.state.error?.message ?? 'An unexpected error occurred while rendering this page.'}
            </p>
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="rounded-xl px-4 py-2 text-sm font-medium border border-gold-500/20 text-gold-300 hover:bg-gold-500/10 transition-colors"
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
