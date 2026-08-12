import { useEffect, useMemo, useState } from 'react';
import { Linkedin, Loader2, ShieldCheck, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';

type Props = { open: boolean; loginUrl: string | null; identityVerified: boolean; securityCheckRequired: boolean; onCancel: () => void };

function presentationUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== 'https:' || !/(^|\.)browserbase\.com$/i.test(url.hostname)) throw new Error('Invalid secure authentication URL');
  url.searchParams.set('navbar', 'false');
  return url.toString();
}

export function SecureLinkedInAuthModal({ open, loginUrl, identityVerified, securityCheckRequired, onCancel }: Props) {
  const [covered, setCovered] = useState(false);
  const [iframeMounted, setIframeMounted] = useState(true);
  const safeUrl = useMemo(() => { try { return loginUrl ? presentationUrl(loginUrl) : null; } catch { return null; } }, [loginUrl]);

  useEffect(() => {
    if (!open) { setCovered(false); setIframeMounted(true); return; }
    if (!identityVerified) return;
    setCovered(true);
    const frame = requestAnimationFrame(() => setIframeMounted(false));
    return () => cancelAnimationFrame(frame);
  }, [open, identityVerified]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-maroon-950 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label="Secure LinkedIn sign-in">
      <div className="flex h-[min(900px,94vh)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-gold-500/20 bg-maroon-900 shadow-2xl">
        <header className="flex shrink-0 items-center justify-between border-b border-gold-500/15 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0A66C2]/15"><Linkedin className="h-5 w-5 text-[#4b9ee8]" /></div>
            <div><h2 className="text-sm font-semibold text-ink-50">Secure LinkedIn sign-in</h2><p className="text-xs text-ink-400">Enter credentials only on linkedin.com. Yuktris never sees or stores your password.</p></div>
          </div>
          <Button variant="ghost" size="sm" onClick={onCancel}><X className="h-4 w-4" /> Cancel</Button>
        </header>
        <div className="relative min-h-0 flex-1 bg-maroon-950">
          {iframeMounted && safeUrl && <iframe title="LinkedIn secure authentication" src={safeUrl} className="h-full w-full border-0" sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-downloads" allow="clipboard-read; clipboard-write" referrerPolicy="no-referrer" />}
          {(!safeUrl || covered) && <div className="absolute inset-0 z-10 flex items-center justify-center bg-maroon-950 px-6 text-center"><div className="max-w-md space-y-3">
            {covered ? <ShieldCheck className="mx-auto h-10 w-10 text-success-500" /> : <Loader2 className="mx-auto h-9 w-9 animate-spin text-brand-300" />}
            <p className="text-base font-semibold text-ink-50">{covered ? 'LinkedIn connected. Finishing secure setup…' : 'Preparing secure LinkedIn sign-in…'}</p>
            <p className="text-sm text-ink-400">{covered ? 'You can safely remain in Yuktris while encrypted session setup completes.' : 'The secure LinkedIn authentication surface will appear here.'}</p>
          </div></div>}
        </div>
        {securityCheckRequired && !covered && <footer className="shrink-0 border-t border-warning-500/20 bg-warning-500/10 px-4 py-3 text-center text-xs text-warning-400">LinkedIn needs an additional security check. Complete it directly in this secure browser. Yuktris remains passive and never collects verification codes.</footer>}
      </div>
    </div>
  );
}
