import { Package, DollarSign, Users, Trophy } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { ProductService } from '@/types/company-research';

type Props = {
  products: ProductService[];
};

export function ProductsTable({ products }: Props) {
  if (products.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-xs text-ink-500">No products or services data available.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-brand-400" />
          <CardTitle>Products & Services</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gold-500/12 text-left">
                <th className="px-4 py-3 text-xs font-medium text-ink-500">Product / Service</th>
                <th className="px-4 py-3 text-xs font-medium text-ink-500">Category</th>
                <th className="px-4 py-3 text-xs font-medium text-ink-500">Pricing Model</th>
                <th className="px-4 py-3 text-xs font-medium text-ink-500">Target Audience</th>
                <th className="px-4 py-3 text-xs font-medium text-ink-500">Competitive Advantage</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-b border-gold-500/8 last:border-0 hover:bg-card-800 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Package className="h-3.5 w-3.5 text-ink-500 shrink-0" />
                      <span className="text-sm text-ink-500 font-medium">{p.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {p.category && <Badge tone="brand">{p.category}</Badge>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <DollarSign className="h-3 w-3 text-ink-500" />
                      <span className="text-xs text-ink-500">{p.pricing_model ?? '—'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <Users className="h-3 w-3 text-ink-500" />
                      <span className="text-xs text-ink-500">{p.target_audience ?? '—'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-start gap-1.5">
                      <Trophy className="h-3 w-3 text-success-400 shrink-0 mt-0.5" />
                      <span className="text-xs text-ink-500">{p.competitive_advantage ?? '—'}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
