import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-luxury text-ink-200">
      <header className="border-b border-gold-500/10 glass-nav sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg"
              style={{ background: 'linear-gradient(135deg, #D4AF37, #E2B93B)', boxShadow: '0 4px 14px -2px rgba(212, 175, 55, 0.3)' }}
            >
              <Sparkles className="h-4 w-4 text-maroon-950" />
            </div>
            <span className="text-base font-semibold tracking-tight text-ink-50">Revenue AI</span>
          </Link>
          <Link to="/">
            <Button variant="ghost" size="sm"><ArrowLeft className="h-3.5 w-3.5" />Back to Home</Button>
          </Link>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-6 py-16 animate-fade-in">{children}</main>
      <footer className="border-t border-gold-500/8"
        style={{ background: 'linear-gradient(180deg, #230006, #2A0208)' }}
      >
        <div className="max-w-5xl mx-auto px-6 py-8 flex items-center justify-between">
          <p className="text-xs text-ink-500">© 2026 Revenue AI. All rights reserved.</p>
          <div className="flex items-center gap-4 text-xs text-ink-500">
            <Link to="/" className="hover:text-gold-400 transition-colors">Home</Link>
            <Link to="/login" className="hover:text-gold-400 transition-colors">Sign in</Link>
            <Link to="/signup" className="hover:text-gold-400 transition-colors">Get Started</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function StaticPage({ title, description, children }: { title: string; description?: string; children?: ReactNode }) {
  return (
    <MarketingLayout>
      <h1 className="text-3xl font-bold tracking-tight text-ink-50 mb-2">{title}</h1>
      {description && <p className="text-sm text-ink-400 mb-8">{description}</p>}
      <div className="prose max-w-none">{children}</div>
    </MarketingLayout>
  );
}
