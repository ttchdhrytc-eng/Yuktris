import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Sparkles, Mail, Lock, User } from 'lucide-react';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { Button } from '@/components/ui/Button';
import { Input, Label } from '@/components/ui/Field';
import { authService } from '@/services/auth';
import { isValidEmail } from '@/lib/utils';

export function SignupPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) {
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

    setLoading(true);
    try {
      const result = await authService.signUp({ email, password, fullName: name });

      if (result.needsEmailVerification) {
        toast.success('Account created! Please verify your email to continue.');
        navigate('/verify-email');
      } else if (result.session) {
        toast.success('Account created! Let\u2019s set up your workspace.');
        navigate('/onboarding');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Sign up failed.');
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

      <h2 className="text-xl font-semibold text-ink-50">Create your account</h2>
      <p className="text-sm text-ink-400 mt-1.5">
        Start generating meetings with AI in minutes.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <Label>Full name</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-500" />
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Doe"
              className="pl-9"
              autoComplete="name"
              autoFocus
            />
          </div>
        </div>
        <div>
          <Label>Work email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-500" />
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="pl-9"
              autoComplete="email"
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
              autoComplete="new-password"
            />
          </div>
        </div>
        <Button type="submit" className="w-full" loading={loading}>
          Create account
        </Button>
      </form>

      <p className="mt-6 text-center text-xs text-ink-500">
        By signing up, you agree to our Terms of Service and Privacy Policy.
      </p>

      <p className="mt-4 text-center text-sm text-ink-400">
        Already have an account?{' '}
        <Link to="/login" className="text-gold-400 hover:text-gold-300 font-medium">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
