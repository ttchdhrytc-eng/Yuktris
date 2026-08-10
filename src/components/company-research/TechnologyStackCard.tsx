import { Cpu, Server, Cloud, ShoppingCart, BarChart3, Brain, Shield, CreditCard, FileCode, Monitor, Mail, Briefcase } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import type { TechnologyProfile, TechCategory } from '@/types/company-research';

type Props = {
  technologies: TechnologyProfile[];
};

const categoryIcons: Record<TechCategory, React.ComponentType<{ className?: string }>> = {
  frontend: Monitor,
  backend: Server,
  hosting: Cloud,
  cloud: Cloud,
  crm: Briefcase,
  marketing: Mail,
  sales: ShoppingCart,
  analytics: BarChart3,
  ai_tools: Brain,
  security: Shield,
  payment: CreditCard,
  cms: FileCode,
};

const categoryLabels: Record<TechCategory, string> = {
  frontend: 'Frontend',
  backend: 'Backend',
  hosting: 'Hosting',
  cloud: 'Cloud',
  crm: 'CRM',
  marketing: 'Marketing',
  sales: 'Sales',
  analytics: 'Analytics',
  ai_tools: 'AI Tools',
  security: 'Security',
  payment: 'Payment',
  cms: 'CMS',
};

export function TechnologyStackCard({ technologies }: Props) {
  if (technologies.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-xs text-ink-500">No technology data available.</p>
        </CardContent>
      </Card>
    );
  }

  const grouped = technologies.reduce((acc, tech) => {
    if (!acc[tech.category]) acc[tech.category] = [];
    acc[tech.category].push(tech);
    return acc;
  }, {} as Record<string, TechnologyProfile[]>);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Cpu className="h-4 w-4 text-brand-400" />
          <CardTitle>Technology Stack</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(Object.keys(grouped) as TechCategory[]).map((category) => {
            const Icon = categoryIcons[category] ?? Cpu;
            return (
              <div key={category} className="rounded-lg border border-gold-500/8 bg-card-900 p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <Icon className="h-3.5 w-3.5 text-brand-400" />
                  <span className="text-xs font-medium text-ink-500">{categoryLabels[category]}</span>
                </div>
                <div className="space-y-1.5">
                  {grouped[category].map((tech) => (
                    <div key={tech.id} className="flex items-center justify-between">
                      <span className="text-xs text-ink-500">{tech.technology_name}</span>
                      <div className="flex items-center gap-1.5">
                        {tech.version && <span className="text-[10px] text-ink-500">v{tech.version}</span>}
                        <div className={cn('h-1.5 w-1.5 rounded-full', tech.confidence >= 85 ? 'bg-success-500' : tech.confidence >= 70 ? 'bg-warning-500' : 'bg-error-500')} />
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
