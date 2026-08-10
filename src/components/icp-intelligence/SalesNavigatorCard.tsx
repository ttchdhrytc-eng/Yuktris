import { Search, Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import type { SalesNavigatorFilters as SalesNavType } from '@/types/icp-intelligence';

type Props = {
  filters: SalesNavType | null;
};

export function SalesNavigatorCard({ filters }: Props) {
  const [copied, setCopied] = useState(false);

  if (!filters) {
    return (
      <Card>
        <CardContent>
          <p className="text-xs text-ink-500 text-center py-8">No Sales Navigator filters available.</p>
        </CardContent>
      </Card>
    );
  }

  const handleCopyBoolean = () => {
    if (filters.boolean_query) {
      navigator.clipboard.writeText(filters.boolean_query);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-brand-400" />
          <CardTitle>Sales Navigator Filters</CardTitle>
        </div>
        <p className="text-xs text-ink-500 mt-0.5">Pre-built LinkedIn Sales Navigator search filters — ready for export</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <FilterGroup label="Industry" values={filters.industry} />
          <FilterGroup label="Company Headcount" values={filters.company_size} />
          <FilterGroup label="Geography" values={filters.location} />
          <FilterGroup label="Keywords" values={filters.keywords} />
          <FilterGroup label="Titles" values={filters.titles} />
          <FilterGroup label="Departments" values={filters.departments} />
          <FilterGroup label="Technology" values={filters.technology} />

          {filters.boolean_query && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-ink-500">Boolean Search Query</span>
                <button
                  onClick={handleCopyBoolean}
                  className="inline-flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300 transition-colors"
                >
                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <div className="rounded-lg border border-gold-500/12 bg-maroon-950 p-3 font-mono text-xs text-ink-500 break-all">
                {filters.boolean_query}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function FilterGroup({ label, values }: { label: string; values: string[] }) {
  if (values.length === 0) return null;
  return (
    <div>
      <span className="text-xs font-medium text-ink-500 block mb-2">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {values.map((v, i) => (
          <Badge key={i} tone="neutral">{v}</Badge>
        ))}
      </div>
    </div>
  );
}
