import { Code2, Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

type Props = {
  booleanQuery: string | null;
};

export function BooleanBuilder({ booleanQuery }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!booleanQuery) return;
    navigator.clipboard.writeText(booleanQuery);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Code2 className="h-4 w-4 text-brand-400" />
            <CardTitle>Boolean Search Query</CardTitle>
          </div>
          {booleanQuery && (
            <Button variant="ghost" size="sm" onClick={handleCopy}>
              {copied ? <Check className="h-3.5 w-3.5 text-success-400" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {booleanQuery ? (
          <div className="rounded-lg border border-gold-500/12 bg-maroon-950 p-4">
            <pre className="text-xs text-ink-500 font-mono whitespace-pre-wrap break-words leading-relaxed">{booleanQuery}</pre>
          </div>
        ) : (
          <p className="text-xs text-ink-500 text-center py-8">No boolean query generated yet.</p>
        )}
        <div className="mt-4 space-y-2">
          <p className="text-xs text-ink-500">Boolean operators used:</p>
          <div className="flex flex-wrap gap-2">
            {['AND', 'OR', 'NOT', 'keyword:', 'industry:', 'company_size:', 'technology:'].map((op) => (
              <span key={op} className="rounded-md bg-card-900 border border-gold-500/12 px-2 py-1 text-[10px] font-mono text-brand-400">{op}</span>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
