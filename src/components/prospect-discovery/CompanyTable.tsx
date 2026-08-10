import { useState, useMemo } from 'react';
import { ExternalLink, Eye, Save, Ban, Microscope, Search, ArrowUpDown } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { ICPMatchBadge } from './ICPMatchBadge';
import { PriorityBadge } from './PriorityBadge';
import { cn } from '@/lib/utils';
import type { CompanyWithScores, CompanyStatus } from '@/types/prospect-discovery';

type Props = {
  companies: CompanyWithScores[];
  onView?: (company: CompanyWithScores) => void;
  onSave?: (company: CompanyWithScores) => void;
  onIgnore?: (company: CompanyWithScores) => void;
  onResearch?: (company: CompanyWithScores) => void;
};

type SortField = 'company_name' | 'opportunity_score' | 'growth_score' | 'icp_match_score';
type SortDir = 'asc' | 'desc';

const statusConfig: Record<CompanyStatus, { label: string; tone: 'default' | 'success' | 'warning' | 'error' | 'brand' | 'neutral' }> = {
  discovered: { label: 'Discovered', tone: 'default' },
  qualified: { label: 'Qualified', tone: 'success' },
  saved: { label: 'Saved', tone: 'brand' },
  ignored: { label: 'Ignored', tone: 'neutral' },
  researching: { label: 'Researching', tone: 'warning' },
};

export function CompanyTable({ companies, onView, onSave, onIgnore, onResearch }: Props) {
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('opportunity_score');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const filtered = useMemo(() => {
    let result = companies;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((c) =>
        c.company_name.toLowerCase().includes(q) ||
        c.industry?.toLowerCase().includes(q) ||
        c.country?.toLowerCase().includes(q) ||
        c.website?.toLowerCase().includes(q)
      );
    }
    result = [...result].sort((a, b) => {
      const aVal = a[sortField] ?? 0;
      const bVal = b[sortField] ?? 0;
      return sortDir === 'desc' ? (bVal as number) - (aVal as number) : (aVal as number) - (bVal as number);
    });
    return result;
  }, [companies, search, sortField, sortDir]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  return (
    <div className="rounded-xl border border-gold-500/12 bg-maroon-900 overflow-hidden">
      {/* Search bar */}
      <div className="border-b border-gold-500/12 p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-500" />
          <input
            type="text"
            placeholder="Search companies..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gold-500/12 bg-maroon-950 pl-9 pr-3 py-2 text-sm text-ink-500 placeholder:text-ink-500 focus:outline-none focus:border-brand-500/50"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gold-500/12 text-left">
              <th className="px-4 py-3 text-xs font-medium text-ink-500">
                <button onClick={() => toggleSort('company_name')} className="flex items-center gap-1 hover:text-ink-500">
                  Company <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="px-4 py-3 text-xs font-medium text-ink-500">Website</th>
              <th className="px-4 py-3 text-xs font-medium text-ink-500">Industry</th>
              <th className="px-4 py-3 text-xs font-medium text-ink-500">Country</th>
              <th className="px-4 py-3 text-xs font-medium text-ink-500">Employees</th>
              <th className="px-4 py-3 text-xs font-medium text-ink-500">Revenue</th>
              <th className="px-4 py-3 text-xs font-medium text-ink-500">
                <button onClick={() => toggleSort('growth_score')} className="flex items-center gap-1 hover:text-ink-500">
                  Growth <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="px-4 py-3 text-xs font-medium text-ink-500">
                <button onClick={() => toggleSort('opportunity_score')} className="flex items-center gap-1 hover:text-ink-500">
                  Opportunity <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="px-4 py-3 text-xs font-medium text-ink-500">
                <button onClick={() => toggleSort('icp_match_score')} className="flex items-center gap-1 hover:text-ink-500">
                  ICP Match <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="px-4 py-3 text-xs font-medium text-ink-500">Status</th>
              <th className="px-4 py-3 text-xs font-medium text-ink-500">Priority</th>
              <th className="px-4 py-3 text-xs font-medium text-ink-500 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((company) => {
              const { label: statusLabel, tone: statusTone } = statusConfig[company.status];
              return (
                <tr key={company.id} className="border-b border-gold-500/8 last:border-0 hover:bg-card-800 transition-colors">
                  <td className="px-4 py-3">
                    <span className="text-sm text-ink-500 font-medium">{company.company_name}</span>
                  </td>
                  <td className="px-4 py-3">
                    {company.website ? (
                      <a href={`https://${company.website}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300">
                        {company.website}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <span className="text-xs text-ink-500">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3"><span className="text-xs text-ink-500">{company.industry ?? '—'}</span></td>
                  <td className="px-4 py-3"><span className="text-xs text-ink-500">{company.country ?? '—'}</span></td>
                  <td className="px-4 py-3"><span className="text-xs text-ink-500">{company.employee_count ?? '—'}</span></td>
                  <td className="px-4 py-3"><span className="text-xs text-ink-500">{company.annual_revenue ?? '—'}</span></td>
                  <td className="px-4 py-3"><ScorePill value={company.growth_score} /></td>
                  <td className="px-4 py-3"><ScorePill value={company.opportunity_score} /></td>
                  <td className="px-4 py-3"><ICPMatchBadge score={company.icp_match_score} /></td>
                  <td className="px-4 py-3"><Badge tone={statusTone} dot>{statusLabel}</Badge></td>
                  <td className="px-4 py-3"><PriorityBadge priority={company.priority} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <ActionBtn icon={Eye} onClick={() => onView?.(company)} />
                      <ActionBtn icon={Save} onClick={() => onSave?.(company)} />
                      <ActionBtn icon={Microscope} onClick={() => onResearch?.(company)} />
                      <ActionBtn icon={Ban} onClick={() => onIgnore?.(company)} danger />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && (
        <p className="text-xs text-ink-500 text-center py-8">No companies match your search.</p>
      )}
    </div>
  );
}

function ScorePill({ value }: { value: number }) {
  const tone = value >= 80 ? 'text-success-400' : value >= 50 ? 'text-warning-500' : 'text-error-400';
  return <span className={cn('text-xs font-semibold', tone)}>{value}</span>;
}

function ActionBtn({ icon: Icon, onClick, danger }: { icon: React.ComponentType<{ className?: string }>; onClick?: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center justify-center rounded-lg p-1.5 transition-colors',
        danger ? 'text-ink-500 hover:text-error-400 hover:bg-error-500/10' : 'text-ink-500 hover:text-ink-500 hover:bg-card-800'
      )}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}
