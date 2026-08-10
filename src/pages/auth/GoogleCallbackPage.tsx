import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';
import { useHandleGoogleCallback } from '@/hooks/useGoogleAuth';

export function GoogleCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mutation = useHandleGoogleCallback();
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      const errorDesc = searchParams.get('error_description');
      const message = error === 'access_denied'
        ? 'You denied access to your Google account.'
        : errorDesc ?? error;
      setTimeout(() => {
        const returnUrl = localStorage.getItem('revenueai_onboarding_active') === 'true'
          ? `/onboarding?google_error=${encodeURIComponent(message)}`
          : `/app/settings?google_error=${encodeURIComponent(message)}`;
        navigate(returnUrl);
      }, 2000);
      return;
    }

    if (!code || !state) {
      setTimeout(() => {
        const returnUrl = localStorage.getItem('revenueai_onboarding_active') === 'true'
          ? '/onboarding?google_error=Missing authorization code or state parameter.'
          : '/app/settings?google_error=Missing authorization code or state parameter.';
        navigate(returnUrl);
      }, 2000);
      return;
    }

    mutation.mutate(
      { code, state },
      {
        onSettled: () => {
          setTimeout(() => {
            const onboardingActive = localStorage.getItem('revenueai_onboarding_active') === 'true';
            localStorage.removeItem('revenueai_onboarding_active');
            // If opened as a popup, close it; otherwise redirect
            if (window.opener) {
              window.close();
            } else {
              navigate(onboardingActive ? '/onboarding?google_connected=true' : '/app/settings?google_connected=true');
            }
          }, 1500);
        },
      }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isError = searchParams.get('error') || (!mutation.isPending && !mutation.data?.success && mutation.data !== undefined);

  return (
    <div className="min-h-screen flex items-center justify-center bg-maroon-950">
      <div className="flex flex-col items-center gap-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-300 to-brand-400 mb-2">
          <Sparkles className="h-4 w-4 text-gold-300" />
        </div>

        {mutation.isPending && (
          <>
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-gold-400 border-t-transparent" />
            <p className="text-sm text-ink-400">Connecting your Google account...</p>
          </>
        )}

        {!mutation.isPending && mutation.data?.success && (
          <>
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-success-500/10 border border-success-500/20 text-success-500">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <p className="text-sm text-ink-100">Google account connected! Redirecting...</p>
          </>
        )}

        {isError && (
          <>
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-error-500/10 border border-error-500/20 text-error-500">
              <AlertCircle className="h-7 w-7" />
            </div>
            <p className="text-sm text-ink-400">
              {searchParams.get('error_description') ?? mutation.data?.error ?? 'Connection failed. Redirecting...'}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
