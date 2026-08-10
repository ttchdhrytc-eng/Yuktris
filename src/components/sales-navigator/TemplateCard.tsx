import { Copy, Star, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type { SearchTemplate } from '@/types/sales-navigator';

type Props = {
  template: SearchTemplate;
  onLoad?: (template: SearchTemplate) => void;
  onDelete?: (template: SearchTemplate) => void;
};

export function TemplateCard({ template, onLoad, onDelete }: Props) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Copy className="h-4 w-4 text-brand-400" />
            <CardTitle>{template.template_name}</CardTitle>
          </div>
          {template.is_default && <Badge tone="brand" dot>Default</Badge>}
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-ink-500 leading-relaxed mb-4">{template.description ?? 'No description'}</p>
        <div className="flex items-center gap-2">
          {onLoad && (
            <Button variant="outline" size="sm" onClick={() => onLoad(template)}>
              <Star className="h-3.5 w-3.5" />
              Load Template
            </Button>
          )}
          {onDelete && !template.is_default && (
            <Button variant="ghost" size="sm" onClick={() => onDelete(template)}>
              <Trash2 className="h-3.5 w-3.5 text-error-400" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
