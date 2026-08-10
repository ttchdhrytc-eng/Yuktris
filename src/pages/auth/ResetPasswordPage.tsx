import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Sparkles, Lock, ArrowLeft } from 'lucide-react';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { Button } from '@/components/ui/Button';
import { Input, Label } from '@/components/ui/Field';
import { authService } from '@/services/auth';

export function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await authService.resetPassword(password);
      setDone(true);
      toast.success('Password updated successfully.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to reset password.');
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

      {done ? (
        <>
          <h2 className="text-xl font-semibold text-ink-50">Password updated</h2>
          <p className="text-sm text-ink-400 mt-1.5">
            Your password has been reset successfully. You can now sign in with your new password.
          </p>
          <Link to="/login" className="block mt-6">
            <Button className="w-full">
              <ArrowLeft className="h-4 w-4" />
              Sign in
            </Button>
          </Link>
        </>
      ) : (
        <>
          <h2 className="text-xl font-semibold text-ink-50">Set new password</h2>
          <p className="text-sm text-ink-400 mt-1.5">
            Enter your new password below.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <Label>New password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-500" />
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="pl-9"
                  autoComplete="new-password"
                  autoFocus
                />
              </div>
            </div>
            <div>
              <Label>Confirm password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-500" />
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className="pl-9"
                  autoComplete="new-password"
                />
              </div>
            </div>
            <Button type="submit" className="w-full" loading={loading}>
              Update password
            </Button>
          </form>
        </>
      )}
    </AuthLayout>
  );
}
