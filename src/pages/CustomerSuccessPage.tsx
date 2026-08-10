import { useState } from 'react';
import {
  Heart, Zap, Users, ShieldAlert, Rocket, Gift,
  BookOpen, Star, FileText, Activity, Calendar,
  Brain, Lightbulb, Bell, TrendingUp, CheckCircle2,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/utils';
import {
  useCustomerSuccessCommandCenter, useSyncCustomers, useCalculateHealth,
  usePredictChurn, useDetectExpansion, useDetectRenewalRisk,
  useGenerateSuccessPlan, useGenerateExecutiveReview,
  useGenerateReferrals, useGenerateCaseStudy,
  useGenerateCustomerInsights, useGenerateRenewalForecast,
} from '@/hooks/useCustomerSuccess';
import {
  ExecutiveOverviewSection, CustomerHealthSection, CustomerJourneySection,
  OnboardingSection, RenewalsSection, ExpansionSection, UpsellSection,
  CrossSellSection, ChurnPredictionSection, ExecutiveReviewsSection,
  SuccessPlansSection, CaseStudiesSection, ReferralsSection,
  ChampionsSection, FeedbackSection, TimelineSection,
  RevenueExpansionSection, CommandCenterEmpty,
} from '@/components/customer-success';

const TABS = [
  { id: 'overview', label: 'Executive Overview', icon: Brain },
  { id: 'health', label: 'Customer Health', icon: Heart },
  { id: 'journey', label: 'Customer Journey', icon: Activity },
  { id: 'onboarding', label: 'Onboarding', icon: CheckCircle2 },
  { id: 'renewals', label: 'Renewals', icon: Calendar },
  { id: 'expansion', label: 'Expansion', icon: Rocket },
  { id: 'upsell', label: 'Upsell', icon: TrendingUp },
  { id: 'crosssell', label: 'Cross Sell', icon: TrendingUp },
  { id: 'churn', label: 'Churn Prediction', icon: ShieldAlert },
  { id: 'reviews', label: 'Executive Reviews', icon: FileText },
  { id: 'insights', label: 'Customer Insights', icon: Lightbulb },
  { id: 'plans', label: 'Success Plans', icon: Heart },
  { id: 'casestudies', label: 'Case Studies', icon: BookOpen },
  { id: 'referrals', label: 'Referrals', icon: Gift },
  { id: 'feedback', label: 'Customer Feedback', icon: Bell },
  { id: 'recommendations', label: 'AI Recommendations', icon: Sparkles },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'timeline', label: 'Customer Timeline', icon: Activity },
  { id: 'revenue-expansion', label: 'Revenue Expansion', icon: Rocket },
] as const;

type TabId = (typeof TABS)[number]['id'];

// Need to import Sparkles
import { Sparkles } from 'lucide-react';

export function CustomerSuccessPage() {
  const { data: cc, isLoading } = useCustomerSuccessCommandCenter();
  const syncCustomers = useSyncCustomers();
  const calculateHealth = useCalculateHealth();
  const predictChurn = usePredictChurn();
  const detectExpansion = useDetectExpansion();
  const detectRenewalRisk = useDetectRenewalRisk();
  const generateSuccessPlan = useGenerateSuccessPlan();
  const generateExecutiveReview = useGenerateExecutiveReview();
  const generateReferrals = useGenerateReferrals();
  const generateCaseStudy = useGenerateCaseStudy();
  const generateInsights = useGenerateCustomerInsights();
  const generateRenewalForecast = useGenerateRenewalForecast();
  const [tab, setTab] = useState<TabId>('overview');

  const runAll = () => {
    syncCustomers.mutate();
    setTimeout(() => detectRenewalRisk.mutate(), 500);
    setTimeout(() => generateRenewalForecast.mutate(), 1000);
    setTimeout(() => generateInsights.mutate(), 1500);
    if (cc && cc.accounts.length > 0) {
      cc.accounts.slice(0, 5).forEach((a, i) => {
        const acct = a as Record<string, string>;
        setTimeout(() => calculateHealth.mutate(acct.id), 2000 + i * 500);
      });
    }
  };

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Customer Success Command Center" description="AI Customer Success Brain — protect and grow revenue." />
        <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>
      </div>
    );
  }

  if (!cc || cc.totalAccounts === 0) {
    return (
      <div>
        <PageHeader title="Customer Success Command Center" description="AI Customer Success Brain — protect and grow revenue." />
        <Card className="p-6">
          <CommandCenterEmpty onSync={() => syncCustomers.mutate()} isSyncing={syncCustomers.isPending} />
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Customer Success Command Center"
        description="AI Customer Success Brain — protect and grow revenue."
        actions={
          <button onClick={runAll} disabled={syncCustomers.isPending} className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-gold-400 to-gold-300 px-4 py-2 text-sm font-medium text-maroon-950 hover:bg-brand-300/15 disabled:opacity-50">
            <Zap className="h-3.5 w-3.5" />Run Full Analysis
          </button>
        }
      />

      {/* AI Copilot banner */}
      <div className="flex items-start gap-3 mb-6 rounded-xl bg-gradient-to-r from-gold-400 to-gold-300/5 border border-brand-500/10 p-4">
        <Brain className="h-5 w-5 text-brand-400 shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm text-ink-500">
            I'm monitoring {cc.totalAccounts} customers. {cc.atRiskAccounts > 0 ? `I identified ${cc.atRiskAccounts} customers with high churn risk.` : 'All customers are healthy.'}{' '}
            {cc.totalExpansionValue > 0 ? `I found expansion opportunities worth $${cc.totalExpansionValue.toLocaleString()}.` : ''}
          </p>
          <p className="text-xs text-ink-500 mt-0.5">Total ARR: ${cc.totalARR.toLocaleString()} · Avg Health: {Math.round(cc.avgHealthScore)}/100 · Upcoming Renewals: {cc.upcomingRenewals}</p>
        </div>
      </div>

      <Card>
        <div className="border-b border-gold-500/12 px-2">
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-thin">
            {TABS.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)} className={cn('flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap', tab === t.id ? 'border-brand-500 text-brand-400' : 'border-transparent text-ink-500 hover:text-ink-500')}>
                <t.icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4">
          {tab === 'overview' && <ExecutiveOverviewSection cc={cc} onSync={() => syncCustomers.mutate()} isSyncing={syncCustomers.isPending} onInsights={() => generateInsights.mutate()} />}
          {tab === 'health' && <CustomerHealthSection cc={cc} />}
          {tab === 'journey' && <CustomerJourneySection cc={cc} />}
          {tab === 'onboarding' && <OnboardingSection cc={cc} />}
          {tab === 'renewals' && <RenewalsSection cc={cc} />}
          {tab === 'expansion' && <ExpansionSection cc={cc} />}
          {tab === 'upsell' && <UpsellSection cc={cc} />}
          {tab === 'crosssell' && <CrossSellSection cc={cc} />}
          {tab === 'churn' && <ChurnPredictionSection cc={cc} />}
          {tab === 'reviews' && <ExecutiveReviewsSection cc={cc} />}
          {tab === 'insights' && <div className="text-center py-8 text-sm text-ink-500">Customer insights are stored in Revenue Insights. Generate insights from the Overview tab.</div>}
          {tab === 'plans' && <SuccessPlansSection cc={cc} />}
          {tab === 'casestudies' && <CaseStudiesSection cc={cc} />}
          {tab === 'referrals' && <ReferralsSection cc={cc} />}
          {tab === 'feedback' && <FeedbackSection cc={cc} />}
          {tab === 'recommendations' && <div className="text-center py-8 text-sm text-ink-500">AI recommendations are generated as customer insights. Use the Run Full Analysis button.</div>}
          {tab === 'notifications' && <div className="text-center py-8 text-sm text-ink-500">Notifications are managed via renewal reminders and churn alerts.</div>}
          {tab === 'timeline' && <TimelineSection cc={cc} />}
          {tab === 'revenue-expansion' && <RevenueExpansionSection cc={cc} />}
        </div>
      </Card>
    </div>
  );
}
