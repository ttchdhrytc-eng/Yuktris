import { Building2, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { FullSNSearch } from '@/types/sales-navigator';

type Props = {
  search: FullSNSearch;
};

export function SearchBuilder({ search }: Props) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-brand-400" />
            <CardTitle>Search Overview</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <dl className="space-y-3">
            <InfoRow label="Search Name" value={search.name} />
            <InfoRow label="Description" value={search.description ?? '—'} />
            <div>
              <dt className="text-xs text-ink-500 mb-1">Search Type</dt>
              <dd>
                <Badge tone="brand" dot>{search.search_type === 'both' ? 'Company + Lead' : search.search_type === 'company' ? 'Company Only' : 'Lead Only'}</Badge>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-ink-500 mb-1">Status</dt>
              <dd>
                <Badge tone={search.status === 'completed' ? 'success' : 'warning'} dot>
                  {search.status.charAt(0).toUpperCase() + search.status.slice(1)}
                </Badge>
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-brand-400" />
            <CardTitle>Search Scores</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <ScoreCircle label="Quality Score" value={search.quality_score} />
            <ScoreCircle label="Coverage Score" value={search.coverage_score} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-ink-500 mb-0.5">{label}</dt>
      <dd className="text-sm text-ink-500">{value}</dd>
    </div>
  );
}

function ScoreCircle({ label, value }: { label: string; value: number }) {
  const tone = value >= 85 ? '#22c55e' : value >= 70 ? '#eab308' : '#ef4444';
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative flex h-20 w-20 items-center justify-center">
        <svg className="absolute inset-0 -rotate-90" viewBox="0 0 110 110">
          <circle cx="55" cy="55" r={radius} fill="none" stroke="#27272a" strokeWidth="6" />
          <circle cx="55" cy="55" r={radius} fill="none" stroke={tone} strokeWidth="6" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-700" />
        </svg>
        <span className="relative text-lg font-semibold text-ink-500">{value}</span>
      </div>
      <span className="text-xs text-ink-500">{label}</span>
    </div>
  );
}
