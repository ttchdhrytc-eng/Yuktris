import { Users, Briefcase, Award, Clock, MapPin, UserCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { LeadFilters } from '@/types/sales-navigator';

type Props = {
  filters: LeadFilters | null;
};

export function LeadFilterCard({ filters }: Props) {
  if (!filters) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-xs text-ink-500">No lead filters available.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-brand-400" />
          <CardTitle>Lead Search Filters</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <FilterSection icon={Briefcase} label="Job Titles" items={filters.job_titles} tone="brand" />
          <FilterSection icon={Users} label="Departments" items={filters.departments} tone="neutral" />
          <FilterSection icon={Award} label="Seniority Levels" items={filters.seniority} tone="warning" />
          <FilterSection icon={UserCheck} label="Relationship" items={filters.relationship} tone="success" />
          <FilterSection icon={MapPin} label="Locations" items={filters.location} tone="neutral" />
          <div className="grid grid-cols-2 gap-4">
            <InfoRow icon={Clock} label="Years in Role" value={filters.years_in_role ?? '—'} />
            <InfoRow icon={Clock} label="Years at Company" value={filters.years_at_company ?? '—'} />
          </div>
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <UserCheck className="h-3.5 w-3.5 text-ink-500" />
              <span className="text-xs font-medium text-ink-500">Open Profile</span>
            </div>
            <Badge tone={filters.open_profile ? 'success' : 'neutral'} dot>
              {filters.open_profile ? 'Enabled' : 'Disabled'}
            </Badge>
          </div>
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

function InfoRow({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="h-3.5 w-3.5 text-ink-500" />
        <span className="text-xs font-medium text-ink-500">{label}</span>
      </div>
      <p className="text-sm text-ink-500">{value}</p>
    </div>
  );
}
