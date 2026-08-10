import { MessageSquare } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import type { MessagingFramework } from '@/types/outreach-strategy';

type Props = {
  framework: MessagingFramework | null;
};

export function MessagingFrameworkCard({ framework }: Props) {
  if (!framework) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-xs text-ink-500">No messaging framework available.</p>
        </CardContent>
      </Card>
    );
  }

  const items = [
    { label: 'Opening Goal', value: framework.opening_goal },
    { label: 'Value Message', value: framework.value_message },
    { label: 'Social Proof', value: framework.social_proof },
    { label: 'Objection Handling Theme', value: framework.objection_handling_theme },
    { label: 'CTA Framework', value: framework.cta_framework },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-brand-400" />
          <CardTitle>Messaging Framework</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.label}>
              <span className="text-xs text-ink-500 block mb-1">{item.label}</span>
              <p className="text-sm text-ink-500 leading-relaxed">{item.value}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
