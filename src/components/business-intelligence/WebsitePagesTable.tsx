import { FileText, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import type { WebsitePage, PageType } from '@/types/business-intelligence';

type Props = {
  pages: WebsitePage[];
};

const pageTypeTone: Record<PageType, 'brand' | 'success' | 'warning' | 'neutral'> = {
  homepage: 'brand',
  services: 'success',
  pricing: 'warning',
  blog: 'neutral',
  resources: 'neutral',
  contact: 'neutral',
  faq: 'neutral',
  testimonials: 'success',
  case_studies: 'brand',
  other: 'neutral',
};

export function WebsitePagesTable({ pages }: Props) {
  if (pages.length === 0) {
    return <p className="text-xs text-ink-500 text-center py-8">No pages extracted yet.</p>;
  }

  return (
    <div className="overflow-x-auto scrollbar-thin">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gold-500/12 text-left">
            <th className="px-4 py-3 text-xs font-medium text-ink-500">Page</th>
            <th className="px-4 py-3 text-xs font-medium text-ink-500">Type</th>
            <th className="px-4 py-3 text-xs font-medium text-ink-500">Summary</th>
            <th className="px-4 py-3 text-xs font-medium text-ink-500 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {pages.map((page) => (
            <tr key={page.id} className="border-b border-gold-500/8 last:border-0 hover:bg-card-800 transition-colors">
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-ink-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm text-ink-500 truncate">{page.page_title ?? 'Untitled'}</p>
                    <p className="text-xs text-ink-500 truncate max-w-[200px]">{page.url}</p>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3">
                <Badge tone={pageTypeTone[page.page_type]}>{page.page_type.replace('_', ' ')}</Badge>
              </td>
              <td className="px-4 py-3">
                <p className="text-xs text-ink-500 max-w-md line-clamp-2">{page.summary ?? 'No summary'}</p>
              </td>
              <td className="px-4 py-3 text-right">
                <a
                  href={page.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex p-1.5 text-ink-500 hover:text-ink-500 transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
