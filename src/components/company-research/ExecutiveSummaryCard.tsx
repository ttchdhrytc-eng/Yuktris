import { FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

type Props = {
  summary: string | null;
};

export function ExecutiveSummaryCard({ summary }: Props) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-brand-400" />
          <CardTitle>Executive Summary</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {summary ? (
          <p className="text-sm text-ink-500 leading-relaxed">{summary}</p>
        ) : (
          <p className="text-xs text-ink-500 text-center py-4">No executive summary available.</p>
        )}
      </CardContent>
    </Card>
  );
}
