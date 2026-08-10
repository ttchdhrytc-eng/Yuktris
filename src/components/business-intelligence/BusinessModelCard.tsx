import { Pencil, Check, X } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

type Props = {
  title: string;
  summary: string;
  confidence: number;
  onEdit?: (newSummary: string) => void;
  icon?: React.ComponentType<{ className?: string }>;
};

export function BusinessModelCard({ title, summary, confidence, onEdit, icon: Icon }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(summary);

  const handleSave = () => {
    onEdit?.(draft);
    setEditing(false);
  };

  const handleCancel = () => {
    setDraft(summary);
    setEditing(false);
  };

  const confidenceTone = confidence >= 80 ? 'text-success-400' : confidence >= 50 ? 'text-warning-500' : 'text-error-400';

  return (
    <div className="rounded-lg border border-gold-500/12 bg-card-900 p-4 transition-colors hover:border-gold-500/25">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="h-4 w-4 text-ink-500" />}
          <h4 className="text-sm font-semibold text-ink-500">{title}</h4>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('text-xs font-medium', confidenceTone)}>{confidence}%</span>
          {onEdit && !editing && (
            <button onClick={() => setEditing(true)} className="text-ink-500 hover:text-ink-500 transition-colors">
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
          {editing && (
            <div className="flex items-center gap-1">
              <button onClick={handleSave} className="text-success-400 hover:text-success-500 transition-colors">
                <Check className="h-3.5 w-3.5" />
              </button>
              <button onClick={handleCancel} className="text-error-400 hover:text-error-500 transition-colors">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
      {editing ? (
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="w-full rounded-md border border-gold-500/12 bg-maroon-950 px-3 py-2 text-xs text-ink-500 focus:border-brand-500 focus:outline-none min-h-[80px] resize-none"
          autoFocus
        />
      ) : (
        <p className="text-xs text-ink-500 leading-relaxed">{summary}</p>
      )}
      {/* Confidence bar */}
      <div className="mt-3 h-1 rounded-full bg-maroon-950 overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', confidence >= 80 ? 'bg-success-500' : confidence >= 50 ? 'bg-warning-500' : 'bg-error-500')}
          style={{ width: `${confidence}%` }}
        />
      </div>
    </div>
  );
}
