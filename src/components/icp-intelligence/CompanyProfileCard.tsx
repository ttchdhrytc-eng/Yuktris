import { Building2, MapPin, Code2, DollarSign, Users, Briefcase, Layers, Globe } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { ICPCompanyProfile } from '@/types/icp-intelligence';

type Props = {
  profile: ICPCompanyProfile | null;
};

export function CompanyProfileCard({ profile }: Props) {
  if (!profile) {
    return <p className="text-xs text-ink-500 text-center py-8">No company profile available.</p>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Company Profile</CardTitle>
        <p className="text-xs text-ink-500 mt-0.5">Target company attributes for this ICP</p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InfoRow icon={Building2} label="Industry" value={profile.industry} />
          <InfoRow icon={Layers} label="Sub-Industry" value={profile.sub_industry} />
          <InfoRow icon={Users} label="Company Size" value={profile.company_size} />
          <InfoRow icon={DollarSign} label="Revenue Range" value={profile.revenue_range} />
          <InfoRow icon={Users} label="Employee Count" value={profile.employee_count} />
          <InfoRow icon={Briefcase} label="Funding Stage" value={profile.funding_stage} />
          <InfoRow icon={Briefcase} label="Business Model" value={profile.business_model} />
          <InfoRow icon={Globe} label="Country" value={profile.country} />
          <InfoRow icon={MapPin} label="Region" value={profile.region} />
          <InfoRow icon={MapPin} label="City" value={profile.city} />
        </div>
        {profile.technology_stack.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center gap-1.5 mb-2 text-ink-500">
              <Code2 className="h-3.5 w-3.5" />
              <span className="text-[10px] font-medium uppercase tracking-wide">Technology Stack</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {profile.technology_stack.map((tech, i) => (
                <Badge key={i} tone="neutral">{tech}</Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string | null }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-0.5 text-ink-500">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[10px] font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-sm text-ink-500">{value ?? '—'}</p>
    </div>
  );
}
