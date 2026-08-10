import { Plug, Zap } from 'lucide-react';

export function IntegrationEmptyState({ onDiscover, isDiscovering }: { onDiscover: () => void; isDiscovering: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-300/10 border border-brand-300/20">
        <Plug className="h-8 w-8 text-brand-300" />
      </div>
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold text-ink-50">Enterprise Integration Hub</h3>
        <p className="text-sm text-ink-500 max-w-md mx-auto leading-relaxed">Connect 45+ providers across CRM, marketing, communication, finance, storage, databases, automation, and AI. Discover available integrations to begin.</p>
      </div>
      <button onClick={onDiscover} disabled={isDiscovering} className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-gold-400 to-gold-300 px-6 py-2.5 text-sm font-medium text-maroon-950 hover:bg-brand-300/20 disabled:opacity-50 transition-colors">
        <Zap className="h-4 w-4" />{isDiscovering ? 'Discovering...' : 'Discover Integrations'}
      </button>
    </div>
  );
}
