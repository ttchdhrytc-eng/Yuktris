import { FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import type { IntentAIRecommendations } from '@/types/buying-intent';

type Props = {
  recommendations: IntentAIRecommendations | null;
};

export function ExecutiveSummaryCard({ recommendations }: Props) {
  if (!recommendations) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-xs text-ink-500">No executive summary available.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-brand-400" />
          <CardTitle>Executive Summary</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-ink-500 leading-relaxed">{recommendations.executive_summary}</p>
      </CardContent>
    </Card>
  );
}
