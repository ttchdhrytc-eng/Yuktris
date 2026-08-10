import { Building2, Globe, MapPin, Users, DollarSign, Target, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { CompanyProfile } from '@/types/company-research';

type Props = {
  profile: CompanyProfile | null;
};

export function CompanyOverviewCard({ profile }: Props) {
  if (!profile) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-xs text-ink-500">No company profile available.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-brand-400" />
          <CardTitle>Company Overview</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="text-sm text-ink-500 leading-relaxed">{profile.description}</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InfoRow icon={Building2} label="Founded" value={profile.founded} />
            <InfoRow icon={MapPin} label="Headquarters" value={profile.headquarters} />
            <InfoRow icon={Users} label="Employees" value={profile.employee_count} />
            <InfoRow icon={DollarSign} label="Annual Revenue" value={profile.annual_revenue} />
            <InfoRow icon={Target} label="Business Model" value={profile.business_model} />
            <InfoRow icon={Globe} label="Target Market" value={profile.target_market} />
          </div>

          {profile.locations.length > 0 && (
            <div>
              <span className="text-xs font-medium text-ink-500 block mb-1.5">Locations</span>
              <div className="flex flex-wrap gap-1.5">
                {profile.locations.map((loc, i) => (
                  <Badge key={i} tone="neutral">{loc}</Badge>
                ))}
              </div>
            </div>
          )}

          {profile.mission && (
            <div className="rounded-lg border border-gold-500/8 bg-card-900 p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Target className="h-3.5 w-3.5 text-brand-400" />
                <span className="text-xs font-medium text-ink-500">Mission</span>
              </div>
              <p className="text-xs text-ink-500 leading-relaxed">{profile.mission}</p>
            </div>
          )}

          {profile.vision && (
            <div className="rounded-lg border border-gold-500/8 bg-card-900 p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Eye className="h-3.5 w-3.5 text-brand-400" />
                <span className="text-xs font-medium text-ink-500">Vision</span>
              </div>
              <p className="text-xs text-ink-500 leading-relaxed">{profile.vision}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string | null }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-0.5">
        <Icon className="h-3.5 w-3.5 text-ink-500" />
        <span className="text-xs text-ink-500">{label}</span>
      </div>
      <p className="text-sm text-ink-500">{value ?? '—'}</p>
    </div>
  );
}
