import { FolderOpen } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { RecommendedAsset, AssetType, AssetPriority } from '@/types/personalization';

type Props = {
  assets: RecommendedAsset[];
};

const assetTypeLabels: Record<AssetType, string> = {
  case_study: 'Case Study',
  testimonial: 'Testimonial',
  portfolio: 'Portfolio',
  landing_page: 'Landing Page',
  whitepaper: 'Whitepaper',
  article: 'Article',
  video: 'Video',
};

const priorityTones: Record<AssetPriority, 'success' | 'warning' | 'error' | 'neutral'> = {
  low: 'neutral',
  medium: 'success',
  high: 'warning',
  critical: 'error',
};

export function AssetRecommendationCard({ assets }: Props) {
  if (!assets || assets.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-xs text-ink-500">No recommended assets available.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <FolderOpen className="h-4 w-4 text-brand-400" />
          <CardTitle>Recommended Assets</CardTitle>
          <Badge tone="brand">{assets.length}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {assets.map((a, i) => (
            <div key={a.id ?? i} className="rounded-lg border border-gold-500/8 bg-card-900 p-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-brand-400">{assetTypeLabels[a.asset_type] ?? a.asset_type}</span>
                <Badge tone={priorityTones[a.priority]} dot>{a.priority}</Badge>
              </div>
              <p className="text-sm text-ink-500 font-medium">{a.title ?? 'N/A'}</p>
              {a.url && (
                <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-400 hover:text-brand-300 transition-colors mt-1 inline-block">
                  View resource →
                </a>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
