import { type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { usePermissions } from '@/hooks/useAuth';
import { Spinner } from '@/components/ui/Spinner';
import type { Permission } from '@/types/auth';
import { AlertCircle } from 'lucide-react';

type ProtectedRouteProps = {
  children: ReactNode;
  requiredPermission?: Permission;
};

export function ProtectedRoute({ children, requiredPermission }: ProtectedRouteProps) {
  const { user, loading, error: authError } = useAuth();
  const { workspace, loading: wsLoading, error: workspaceError, refresh } = useWorkspace();
  const { can } = usePermissions();
  const location = useLocation();

  if (loading || wsLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-maroon-950">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (authError || workspaceError) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-maroon-950 gap-4 p-6">
        <AlertCircle className="h-8 w-8 text-error-500" />
        <h2 className="text-lg font-semibold text-ink-100">We could not load your Yuktris workspace.</h2>
        <p className="max-w-md text-center text-sm text-ink-400">Check your connection and retry. Your saved onboarding progress is safe.</p>
        <button onClick={() => void refresh()} className="rounded-xl bg-gold-400 px-4 py-2 text-sm font-semibold text-maroon-950">Retry</button>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Allow onboarding route regardless of workspace state
  if (location.pathname === '/onboarding') {
    return <>{children}</>;
  }

  if (!workspace) {
    return <Navigate to="/onboarding" replace />;
  }

  if (workspace && !workspace.onboarding_completed) {
    return <Navigate to="/onboarding" replace />;
  }

  if (requiredPermission && !can(requiredPermission)) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-maroon-950 gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-error-500/10 border border-error-500/20 text-error-500">
          <AlertCircle className="h-7 w-7" />
        </div>
        <h2 className="text-lg font-semibold text-ink-500">Access Denied</h2>
        <p className="text-sm text-ink-500 max-w-sm text-center">
          You do not have permission to access this page. Contact your workspace administrator if you believe this is an error.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
