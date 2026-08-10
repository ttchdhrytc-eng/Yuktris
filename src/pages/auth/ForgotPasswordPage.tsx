import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Sparkles, Mail, ArrowLeft } from 'lucide-react';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { Button } from '@/components/ui/Button';
import { Input, Label } from '@/components/ui/Field';
import { authService } from '@/services/auth';
import { isValidEmail } from '@/lib/utils';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isValidEmail(email)) {
      toast.error('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      await authService.forgotPassword(email);
      setSent(true);
      toast.success('Reset link sent to your email.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send reset link.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="lg:hidden flex items-center gap-2.5 mb-8">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-300 to-brand-400">
          <Sparkles className="h-4 w-4 text-gold-300" />
        </div>
        <span className="text-base font-semibold text-ink-50">Revenue AI</span>
      </div>

      {sent ? (
        <>
          <h2 className="text-xl font-semibold text-ink-50">Check your email</h2>
          <p className="text-sm text-ink-400 mt-1.5">
            We've sent a password reset link to <span className="text-gold-400 font-medium">{email}</span>.
          </p>
          <Link to="/login">
            <Button variant="outline" className="w-full mt-6">
              <ArrowLeft className="h-4 w-4" />
              Back to sign in
            </Button>
          </Link>
        </>
      ) : (
        <>
          <h2 className="text-xl font-semibold text-ink-50">Reset password</h2>
          <p className="text-sm text-ink-400 mt-1.5">
            Enter your email and we'll send you a reset link.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <Label>Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-500" />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="pl-9"
                  autoComplete="email"
                  autoFocus
                />
              </div>
            </div>
            <Button type="submit" className="w-full" loading={loading}>
              Send reset link
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-ink-400">
            Remember your password?{' '}
            <Link to="/login" className="text-gold-400 hover:text-gold-300 font-medium">
              Sign in
            </Link>
          </p>
        </>
      )}
    </AuthLayout>
  );
}
