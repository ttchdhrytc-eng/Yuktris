import { Link } from 'react-router-dom';
import { Sparkles, MailCheck } from 'lucide-react';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';

export function VerifyEmailPage() {
  const { user } = useAuth();

  return (
    <AuthLayout>
      <div className="lg:hidden flex items-center gap-2.5 mb-8">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-300 to-brand-400">
          <Sparkles className="h-4 w-4 text-gold-300" />
        </div>
        <span className="text-base font-semibold text-ink-50">Revenue AI</span>
      </div>

      <div className="flex flex-col items-center text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gold-400/5 border border-gold-400/20 text-gold-400 mb-5 shadow-card">
          <MailCheck className="h-7 w-7" />
        </div>
        <h2 className="text-xl font-semibold text-ink-50">Verify your email</h2>
        <p className="text-sm text-ink-400 mt-2 max-w-xs">
          We've sent a verification link to{' '}
          <span className="text-gold-400 font-medium">{user?.email ?? 'your email address'}</span>.
          Click the link to confirm your account and get started.
        </p>
        <Link to="/login" className="w-full mt-6">
          <Button variant="outline" className="w-full">
            Back to sign in
          </Button>
        </Link>
      </div>
    </AuthLayout>
  );
}
