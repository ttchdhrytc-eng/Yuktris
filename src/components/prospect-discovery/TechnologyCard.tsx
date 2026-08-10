import { Code2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { TechnologyStackResult } from '@/types/prospect-discovery';

type Props = {
  techStack: TechnologyStackResult;
  companyName: string;
};

const categories: { key: keyof TechnologyStackResult; label: string }[] = [
  { key: 'frontend', label: 'Frontend' },
  { key: 'backend', label: 'Backend' },
  { key: 'crm', label: 'CRM' },
  { key: 'marketing_stack', label: 'Marketing Stack' },
  { key: 'sales_tools', label: 'Sales Tools' },
  { key: 'cloud_platform', label: 'Cloud Platform' },
  { key: 'ai_tools', label: 'AI Tools' },
];

export function TechnologyCard({ techStack, companyName }: Props) {
  const hasData = categories.some((c) => techStack[c.key].length > 0);

  if (!hasData) {
    return (
      <Card>
        <CardContent>
          <p className="text-xs text-ink-500 text-center py-8">No technology stack data available for {companyName}.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Code2 className="h-4 w-4 text-brand-400" />
          <CardTitle>Technology Stack — {companyName}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {categories.map(({ key, label }) => {
            const values = techStack[key];
            if (values.length === 0) return null;
            return (
              <div key={key}>
                <span className="text-xs font-medium text-ink-500 block mb-2">{label}</span>
                <div className="flex flex-wrap gap-1.5">
                  {values.map((v, i) => (
                    <Badge key={i} tone="neutral">{v}</Badge>
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
