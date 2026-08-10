import { useState, useEffect, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Sparkles, Mail, Lock, User, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { Button } from '@/components/ui/Button';
import { Input, Label } from '@/components/ui/Field';
import { authService } from '@/services/auth';
import { isValidEmail } from '@/lib/utils';
import type { Invitation } from '@/types/auth';

export function InviteAcceptancePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<'signin' | 'signup'>('signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('No invitation token provided.');
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const inv = await authService.getInvitationByToken(token);
        if (!inv) {
          setError('Invitation not found.');
        } else if (inv.accepted_at) {
          setError('This invitation has already been accepted.');
        } else if (new Date(inv.expires_at) < new Date()) {
          setError('This invitation has expired.');
        } else {
          setInvitation(inv);
          setEmail(inv.email);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load invitation.');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (mode === 'signup' && name.trim().length < 2) {
      toast.error('Please enter your name.');
      return;
    }
    if (!isValidEmail(email)) {
      toast.error('Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }

    setSubmitting(true);
    try {
      let userId: string;

      if (mode === 'signup') {
        const result = await authService.signUp({ email, password, fullName: name });
        if (!result.user) throw new Error('Sign up failed.');
        userId = result.user.id;
      } else {
        const result = await authService.signIn({ email, password });
        if (!result.user) throw new Error('Sign in failed.');
        userId = result.user.id;
      }

      await authService.acceptInvitation({ token, userId, email });
      toast.success('Welcome to the workspace!');
      navigate('/app');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to accept invitation.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <AuthLayout>
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gold-400 border-t-transparent" />
        </div>
      </AuthLayout>
    );
  }

  if (error) {
    return (
      <AuthLayout>
        <div className="flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-error-500/10 border border-error-500/20 text-error-500 mb-5">
            <AlertCircle className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-semibold text-ink-50">Invitation Error</h2>
          <p className="text-sm text-ink-400 mt-2 max-w-xs">{error}</p>
          <Link to="/login" className="w-full mt-6">
            <Button variant="outline" className="w-full">Back to sign in</Button>
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="lg:hidden flex items-center gap-2.5 mb-8">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-300 to-brand-400">
          <Sparkles className="h-4 w-4 text-gold-300" />
        </div>
        <span className="text-base font-semibold text-ink-50">Revenue AI</span>
      </div>

      <div className="flex items-center gap-2.5 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success-500/10 border border-success-500/20 text-success-500">
          <CheckCircle2 className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-ink-50">You're invited!</h2>
          <p className="text-xs text-ink-400">
            Join <span className="text-gold-400">{invitation?.workspace?.name ?? 'the workspace'}</span> as{' '}
            <span className="text-gold-400 capitalize">{invitation?.role.replace(/_/g, ' ')}</span>
          </p>
        </div>
      </div>

      <div className="flex gap-2 mb-4 rounded-lg bg-card-900 p-1">
        <button
          onClick={() => setMode('signup')}
          className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${mode === 'signup' ? 'bg-gradient-to-r from-gold-400 to-gold-300 text-maroon-950' : 'text-ink-400 hover:text-gold-400'}`}
        >
          Create account
        </button>
        <button
          onClick={() => setMode('signin')}
          className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${mode === 'signin' ? 'bg-gradient-to-r from-gold-400 to-gold-300 text-maroon-950' : 'text-ink-400 hover:text-gold-400'}`}
        >
          Sign in
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === 'signup' && (
          <div>
            <Label>Full name</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-500" />
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Doe"
                className="pl-9"
                autoFocus
              />
            </div>
          </div>
        )}
        <div>
          <Label>Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-500" />
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        <div>
          <Label>Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-500" />
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              className="pl-9"
            />
          </div>
        </div>
        <Button type="submit" className="w-full" loading={submitting}>
          Accept invitation
          <ArrowRight className="h-4 w-4" />
        </Button>
      </form>
    </AuthLayout>
  );
}
