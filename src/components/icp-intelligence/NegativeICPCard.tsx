import { Ban, Building2, Globe, Users, Code2, DollarSign } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import type { ICPNegativeFilter, NegativeFilterType } from '@/types/icp-intelligence';

type Props = {
  negativeFilters: ICPNegativeFilter[];
};

const filterTypeConfig: Record<NegativeFilterType, { icon: React.ComponentType<{ className?: string }>; label: string }> = {
  industry: { icon: Building2, label: 'Industries to Avoid' },
  country: { icon: Globe, label: 'Countries to Avoid' },
  company_size: { icon: Users, label: 'Company Sizes to Avoid' },
  technology: { icon: Code2, label: 'Technologies to Avoid' },
  revenue_range: { icon: DollarSign, label: 'Revenue Ranges to Avoid' },
};

export function NegativeICPCard({ negativeFilters }: Props) {
  if (negativeFilters.length === 0) {
    return (
      <Card>
        <CardContent>
          <p className="text-xs text-ink-500 text-center py-8">No negative filters defined.</p>
        </CardContent>
      </Card>
    );
  }

  const grouped = negativeFilters.reduce((acc, f) => {
    if (!acc[f.filter_type]) acc[f.filter_type] = [];
    acc[f.filter_type].push(f);
    return acc;
  }, {} as Record<NegativeFilterType, ICPNegativeFilter[]>);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Ban className="h-4 w-4 text-error-400" />
          <CardTitle>Negative ICP — Exclusion Criteria</CardTitle>
        </div>
        <p className="text-xs text-ink-500 mt-0.5">Companies and attributes to exclude from targeting</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {(Object.entries(grouped) as [NegativeFilterType, ICPNegativeFilter[]][]).map(([type, items]) => {
            const { icon: Icon, label } = filterTypeConfig[type];
            return (
              <div key={type}>
                <div className="flex items-center gap-1.5 mb-2 text-ink-500">
                  <Icon className="h-3.5 w-3.5" />
                  <span className="text-xs font-medium">{label}</span>
                </div>
                <div className="space-y-1.5">
                  {items.map((item) => (
                    <div key={item.id} className="flex items-start gap-2 rounded-lg border border-error-500/10 bg-error-500/5 px-3 py-2">
                      <Ban className="h-3 w-3 text-error-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs text-ink-500 font-medium">{item.value}</p>
                        {item.reason && <p className="text-xs text-ink-500 mt-0.5">{item.reason}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
