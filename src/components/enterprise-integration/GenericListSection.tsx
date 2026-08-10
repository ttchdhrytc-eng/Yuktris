import { Card } from '@/components/ui/Card';
import { timeAgo } from '@/lib/utils';

export function GenericListSection({ items, titleKey, descKey }: { items: Array<Record<string, unknown>>; titleKey: string; descKey: string }) {
  if (items.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No data available.</div>;
  return (
    <div className="space-y-2">
      {items.slice(0, 20).map((item, i) => (
        <Card key={i} className="p-3">
          <p className="text-sm text-ink-500">{(item[titleKey] as string) ?? 'Item'}</p>
          <p className="text-xs text-ink-500 mt-0.5">{((item[descKey] as string) ?? '').slice(0, 120)}</p>
        </Card>
      ))}
    </div>
  );
}
