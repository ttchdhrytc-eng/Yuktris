import { MapPin, Clock, Building2, GraduationCap, Award, Wrench } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { ContactProfile } from '@/types/decision-maker-research';

type Props = {
  profile: ContactProfile | null;
};

export function ProfessionalProfileCard({ profile }: Props) {
  if (!profile) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-xs text-ink-500">No professional profile available.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Professional Information</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InfoRow icon={MapPin} label="Location" value={profile.location} />
            <InfoRow icon={Clock} label="Years in Current Role" value={profile.years_current_role} />
            <InfoRow icon={Clock} label="Years at Company" value={profile.years_company} />
          </div>

          {profile.education.length > 0 && (
            <Section icon={GraduationCap} label="Education">
              <div className="space-y-1">
                {profile.education.map((edu, i) => (
                  <p key={i} className="text-xs text-ink-500">{edu}</p>
                ))}
              </div>
            </Section>
          )}

          {profile.skills.length > 0 && (
            <Section icon={Wrench} label="Skills">
              <div className="flex flex-wrap gap-1.5">
                {profile.skills.map((skill, i) => (
                  <Badge key={i} tone="brand">{skill}</Badge>
                ))}
              </div>
            </Section>
          )}

          {profile.certifications.length > 0 && (
            <Section icon={Award} label="Certifications">
              <div className="flex flex-wrap gap-1.5">
                {profile.certifications.map((cert, i) => (
                  <Badge key={i} tone="success">{cert}</Badge>
                ))}
              </div>
            </Section>
          )}

          {profile.previous_companies.length > 0 && (
            <Section icon={Building2} label="Previous Companies">
              <div className="flex flex-wrap gap-1.5">
                {profile.previous_companies.map((co, i) => (
                  <Badge key={i} tone="neutral">{co}</Badge>
                ))}
              </div>
            </Section>
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

function Section({ icon: Icon, label, children }: { icon: React.ComponentType<{ className?: string }>; label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <Icon className="h-3.5 w-3.5 text-ink-500" />
        <span className="text-xs font-medium text-ink-500">{label}</span>
      </div>
      {children}
    </div>
  );
}
