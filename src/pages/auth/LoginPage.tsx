import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Sparkles, Mail, Lock, Wand2 } from 'lucide-react';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { Button } from '@/components/ui/Button';
import { Input, Label } from '@/components/ui/Field';
import { authService } from '@/services/auth';
import { isValidEmail } from '@/lib/utils';

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [magicLinkMode, setMagicLinkMode] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isValidEmail(email)) {
      toast.error('Please enter a valid email address.');
      return;
    }
    if (!magicLinkMode && password.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      if (magicLinkMode) {
        await authService.signInWithMagicLink(email);
        setMagicLinkSent(true);
        toast.success('Magic link sent! Check your email.');
      } else {
        await authService.signIn({ email, password });
        toast.success('Welcome back!');
        navigate('/app');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Sign in failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="lg:hidden flex items-center gap-2.5 mb-8">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-lg"
          style={{ background: 'linear-gradient(135deg, #D4AF37, #E2B93B)' }}
        >
          <Sparkles className="h-4 w-4 text-maroon-950" />
        </div>
        <span className="text-base font-semibold text-ink-50">Revenue AI</span>
      </div>

      {magicLinkSent ? (
        <div className="animate-fade-in-up">
          <h2 className="text-xl font-semibold text-ink-50">Check your email</h2>
          <p className="text-sm text-ink-400 mt-1.5">
            We've sent a magic sign-in link to <span className="text-gold-400 font-medium">{email}</span>. Click the link to sign in.
          </p>
          <Link to="/login" className="block mt-6">
            <Button variant="secondary" className="w-full">Back to sign in</Button>
          </Link>
        </div>
      ) : (
        <div className="animate-fade-in-up">
          <h2 className="text-xl font-semibold text-ink-50">Sign in</h2>
          <p className="text-sm text-ink-400 mt-1.5">Welcome back. Enter your credentials to continue.</p>

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
            {!magicLinkMode && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label>Password</Label>
                  <Link to="/forgot-password" className="text-xs text-gold-400 hover:text-gold-300 transition-colors">
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-500" />
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-9"
                    autoComplete="current-password"
                  />
                </div>
              </div>
            )}
            <Button type="submit" className="w-full" loading={loading}>
              {magicLinkMode ? 'Send magic link' : 'Sign in'}
            </Button>
          </form>

          <button
            onClick={() => {
              setMagicLinkMode((v) => !v);
              setMagicLinkSent(false);
            }}
            className="mt-4 w-full flex items-center justify-center gap-2 text-xs text-ink-500 hover:text-gold-400 transition-colors"
          >
            <Wand2 className="h-3.5 w-3.5" />
            {magicLinkMode ? 'Use password instead' : 'Sign in with magic link'}
          </button>

          <p className="mt-6 text-center text-sm text-ink-400">
            Don't have an account?{' '}
            <Link to="/signup" className="text-gold-400 hover:text-gold-300 font-medium transition-colors">
              Sign up
            </Link>
          </p>
        </div>
      )}
    </AuthLayout>
  );
}
