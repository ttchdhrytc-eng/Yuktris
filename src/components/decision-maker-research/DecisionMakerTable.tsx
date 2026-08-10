import { Users, Eye, Search, Bookmark, Ban } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { BuyingRoleBadge } from './BuyingRoleBadge';
import { cn } from '@/lib/utils';
import type { FullContact, ContactPriority } from '@/types/decision-maker-research';

type Props = {
  contacts: FullContact[];
  onSelectContact?: (contact: FullContact) => void;
};

const priorityTones: Record<ContactPriority, 'success' | 'warning' | 'error' | 'brand'> = {
  low: 'neutral',
  medium: 'brand',
  high: 'warning',
  critical: 'error',
} as Record<ContactPriority, 'success' | 'warning' | 'error' | 'brand'>;

export function DecisionMakerTable({ contacts, onSelectContact }: Props) {
  if (contacts.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-xs text-ink-500">No decision makers found.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-brand-400" />
          <CardTitle>Decision Makers</CardTitle>
          <Badge tone="neutral">{contacts.length} contacts</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gold-500/12 text-left">
                <th className="px-3 py-3 text-xs font-medium text-ink-500">Name</th>
                <th className="px-3 py-3 text-xs font-medium text-ink-500">Title</th>
                <th className="px-3 py-3 text-xs font-medium text-ink-500">Dept</th>
                <th className="px-3 py-3 text-xs font-medium text-ink-500">Seniority</th>
                <th className="px-3 py-3 text-xs font-medium text-ink-500">Buying Role</th>
                <th className="px-3 py-3 text-xs font-medium text-ink-500">Activity</th>
                <th className="px-3 py-3 text-xs font-medium text-ink-500">Influence</th>
                <th className="px-3 py-3 text-xs font-medium text-ink-500">Readiness</th>
                <th className="px-3 py-3 text-xs font-medium text-ink-500">Priority</th>
                <th className="px-3 py-3 text-xs font-medium text-ink-500 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => (
                <tr key={c.id} className="border-b border-gold-500/8 last:border-0 hover:bg-card-800 transition-colors">
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-gold-400 to-gold-300/10 text-brand-400 text-xs font-semibold shrink-0">
                        {c.first_name[0]}{c.last_name[0]}
                      </div>
                      <span className="text-sm text-ink-500 font-medium">{c.first_name} {c.last_name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-xs text-ink-500">{c.job_title ?? '—'}</td>
                  <td className="px-3 py-3 text-xs text-ink-500">{c.department ?? '—'}</td>
                  <td className="px-3 py-3 text-xs text-ink-500">{c.seniority ?? '—'}</td>
                  <td className="px-3 py-3"><BuyingRoleBadge role={c.buying_role} /></td>
                  <td className="px-3 py-3">
                    <ScoreBar value={c.activity_score} />
                  </td>
                  <td className="px-3 py-3">
                    <ScoreBar value={c.influence_score} />
                  </td>
                  <td className="px-3 py-3">
                    <ScoreBar value={c.outreach_readiness} />
                  </td>
                  <td className="px-3 py-3">
                    <Badge tone={priorityTones[c.priority]}>{c.priority}</Badge>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => onSelectContact?.(c)}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Search className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Bookmark className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Ban className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function ScoreBar({ value }: { value: number }) {
  const tone = value >= 85 ? 'bg-success-500' : value >= 70 ? 'bg-warning-500' : 'bg-error-500';
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 rounded-full bg-card-900 overflow-hidden">
        <div className={cn('h-full rounded-full transition-all duration-500', tone)} style={{ width: `${value}%` }} />
      </div>
      <span className="text-[10px] text-ink-500 font-mono">{value}</span>
    </div>
  );
}
