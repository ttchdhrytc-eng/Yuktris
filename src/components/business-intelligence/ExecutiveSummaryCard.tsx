import { FileText } from 'lucide-react';

type Props = {
  summary: string;
};

export function ExecutiveSummaryCard({ summary }: Props) {
  return (
    <div className="rounded-xl border border-gold-500/12 bg-maroon-900 p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-r from-gold-400 to-gold-300/10 text-brand-400">
          <FileText className="h-4 w-4" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-ink-500">Executive Summary</h3>
          <p className="text-xs text-ink-500">AI-generated overview of the business</p>
        </div>
      </div>
      <p className="text-sm text-ink-500 leading-relaxed">{summary}</p>
    </div>
  );
}
