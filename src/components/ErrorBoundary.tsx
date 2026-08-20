import { Component, type ReactNode, type ErrorInfo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Props = { children: ReactNode };
type State = { hasError: boolean; error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[customer-app-error]', { name: error.name, message: error.message, componentStack: info.componentStack });
  }

  private retry = () => window.location.reload();

  private returnToDashboard = () => {
    this.setState({ hasError: false, error: null });
    window.location.assign('/app');
  };

  private signOut = async () => {
    await supabase.auth.signOut();
    window.location.assign('/login');
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 p-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-error-500/10 border border-error-500/20">
            <AlertTriangle className="h-6 w-6 text-error-400" />
          </div>
          <div className="text-center">
            <h2 className="text-lg font-semibold text-ink-50 mb-1">Something went wrong loading Yuktris.</h2>
            <p className="text-sm text-ink-400 max-w-md">
              Your account is safe. Retry the page or return to your dashboard.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <button onClick={this.retry} className="rounded-xl px-4 py-2 text-sm font-medium bg-gold-400 text-maroon-950 hover:bg-gold-300 transition-colors">Retry</button>
            <button onClick={this.returnToDashboard} className="rounded-xl px-4 py-2 text-sm font-medium border border-gold-500/20 text-gold-300 hover:bg-gold-500/10 transition-colors">Return to Dashboard</button>
            <button onClick={() => void this.signOut()} className="rounded-xl px-4 py-2 text-sm font-medium text-ink-400 hover:text-ink-100 transition-colors">Sign out</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
