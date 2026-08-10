import { BarChart3, CheckCircle2, AlertTriangle, Activity, Zap, Heart } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import type { IntegrationDashboard } from '@/hooks/useEnterpriseIntegration';

export function OverviewSection({ id, onDiscover, isDiscovering, onMonitorHealth, isMonitoring }: {
  id: IntegrationDashboard; onDiscover: () => void; isDiscovering: boolean;
  onMonitorHealth: () => void; isMonitoring: boolean;
}) {
  const stats = [
    { label: 'Providers', value: id.providers.length, icon: BarChart3 },
    { label: 'Connected', value: id.connections.filter((c) => (c as Record<string, unknown>).connection_status === 'connected').length, icon: CheckCircle2 },
    { label: 'Sync Jobs', value: id.syncJobs.length, icon: Activity },
    { label: 'Errors', value: id.errors.length, icon: AlertTriangle },
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-4">
            <div className="flex items-center gap-2 mb-1"><s.icon className="h-4 w-4 text-brand-300" /><span className="text-xs text-ink-500">{s.label}</span></div>
            <p className="text-2xl font-bold text-ink-50">{s.value}</p>
          </Card>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <button onClick={onDiscover} disabled={isDiscovering} className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-gold-400 to-gold-300 px-3 py-2 text-sm font-medium text-maroon-950 hover:bg-brand-300/20 disabled:opacity-50 transition-colors"><Zap className="h-3.5 w-3.5" />{isDiscovering ? 'Discovering...' : 'Discover Integrations'}</button>
        <button onClick={onMonitorHealth} disabled={isMonitoring} className="flex items-center gap-2 rounded-lg border border-gold-500/12 bg-maroon-900 px-3 py-2 text-sm font-medium text-ink-200 hover:bg-card-800 disabled:opacity-50 transition-colors"><Heart className="h-3.5 w-3.5" />{isMonitoring ? 'Checking...' : 'Health Check'}</button>
      </div>
    </div>
  );
}
