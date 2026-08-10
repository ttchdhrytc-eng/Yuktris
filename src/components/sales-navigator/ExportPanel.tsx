import { useState } from 'react';
import { Download, FileJson, FileText, Code2, Send } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import type { FullSNSearch, ExportFormat } from '@/types/sales-navigator';

type Props = {
  search: FullSNSearch;
  onExport: (format: ExportFormat) => void;
  loading?: boolean;
};

const FORMATS: { id: ExportFormat; label: string; icon: React.ComponentType<{ className?: string }>; description: string }[] = [
  { id: 'json', label: 'JSON', icon: FileJson, description: 'Full search configuration in JSON format' },
  { id: 'csv', label: 'CSV', icon: FileText, description: 'Spreadsheet-compatible CSV export' },
  { id: 'config', label: 'Config', icon: Code2, description: 'Configuration file for import' },
  { id: 'api_payload', label: 'API Payload', icon: Send, description: 'Ready-to-use API request payload' },
];

export function ExportPanel({ onExport, loading }: Omit<Props, 'search'>) {
  const [selected, setSelected] = useState<ExportFormat>('json');

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Download className="h-4 w-4 text-brand-400" />
          <CardTitle>Export Search Configuration</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          {FORMATS.map((fmt) => (
            <button
              key={fmt.id}
              onClick={() => setSelected(fmt.id)}
              className={cn(
                'flex items-start gap-3 rounded-lg border p-3 text-left transition-colors',
                selected === fmt.id
                  ? 'border-brand-500 bg-gradient-to-r from-gold-400 to-gold-300/10'
                  : 'border-gold-500/12 bg-card-900 hover:border-gold-500/25'
              )}
            >
              <fmt.icon className={cn('h-4 w-4 shrink-0 mt-0.5', selected === fmt.id ? 'text-brand-400' : 'text-ink-500')} />
              <div>
                <p className={cn('text-sm font-medium', selected === fmt.id ? 'text-brand-400' : 'text-ink-500')}>{fmt.label}</p>
                <p className="text-xs text-ink-500 mt-0.5">{fmt.description}</p>
              </div>
            </button>
          ))}
        </div>
        <Button onClick={() => onExport(selected)} loading={loading} className="w-full">
          <Download className="h-4 w-4" />
          Export as {selected.toUpperCase()}
        </Button>
        <div className="mt-4 rounded-lg border border-gold-500/8 bg-maroon-950 p-3">
          <p className="text-xs text-ink-500">
            Export includes: search name, type, quality scores, company filters, lead filters, and boolean query.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
