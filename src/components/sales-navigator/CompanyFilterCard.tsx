import { Building2, Globe, Cpu, DollarSign, Tag, Ban, Layers } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { CompanyFilters } from '@/types/sales-navigator';

type Props = {
  filters: CompanyFilters | null;
};

export function CompanyFilterCard({ filters }: Props) {
  if (!filters) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-xs text-ink-500">No company filters available.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-brand-400" />
          <CardTitle>Company Search Filters</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <FilterSection icon={Layers} label="Industries" items={filters.industry} tone="brand" />
          <FilterSection icon={Building2} label="Company Size" items={filters.company_size} tone="neutral" />
          <FilterSection icon={DollarSign} label="Revenue Range" items={filters.revenue} tone="success" />
          <FilterSection icon={Globe} label="Countries" items={filters.country} tone="neutral" />
          <FilterSection icon={Cpu} label="Technologies" items={filters.technology} tone="brand" />
          <FilterSection icon={Building2} label="Company Type" items={filters.company_type} tone="neutral" />
          <FilterSection icon={Layers} label="Growth Stage" items={filters.growth_stage} tone="warning" />
          <FilterSection icon={Tag} label="Keywords" items={filters.keywords} tone="brand" />
          <FilterSection icon={Ban} label="Negative Keywords" items={filters.negative_keywords} tone="error" />
        </div>
      </CardContent>
    </Card>
  );
}

function FilterSection({ icon: Icon, label, items, tone }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  items: string[];
  tone: 'brand' | 'neutral' | 'success' | 'warning' | 'error';
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <Icon className="h-3.5 w-3.5 text-ink-500" />
        <span className="text-xs font-medium text-ink-500">{label}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item, i) => (
          <Badge key={i} tone={tone}>{item}</Badge>
        ))}
      </div>
    </div>
  );
}
