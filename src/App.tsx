import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { Suspense, lazy } from 'react';
import { queryClient } from '@/lib/queryClient';
import { AuthProvider } from '@/contexts/AuthContext';
import { WorkspaceProvider } from '@/contexts/WorkspaceContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AppLayout } from '@/components/layout/AppLayout';
import { Spinner } from '@/components/ui/Spinner';

// Eager: auth pages (needed before anything)
import { LoginPage } from '@/pages/auth/LoginPage';
import { SignupPage } from '@/pages/auth/SignupPage';
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage';
import { VerifyEmailPage } from '@/pages/auth/VerifyEmailPage';
import { ResetPasswordPage } from '@/pages/auth/ResetPasswordPage';
import { InviteAcceptancePage } from '@/pages/auth/InviteAcceptancePage';
import { GoogleCallbackPage } from '@/pages/auth/GoogleCallbackPage';

// Lazy: marketing pages
const LandingPage = lazy(() => import('@/pages/marketing/LandingPage').then(m => ({ default: m.LandingPage })));
const StaticPages = lazy(() => import('@/pages/marketing/StaticPages'));

// Lazy: onboarding
const OnboardingPage = lazy(() => import('@/pages/OnboardingPage').then(m => ({ default: m.OnboardingPage })));

// Lazy: core app pages
const DashboardPage = lazy(() => import('@/pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const ProspectsPage = lazy(() => import('@/pages/ProspectsPage').then(m => ({ default: m.ProspectsPage })));
const MeetingsPage = lazy(() => import('@/pages/MeetingsPage').then(m => ({ default: m.MeetingsPage })));
const AnalyticsPage = lazy(() => import('@/pages/AnalyticsPage').then(m => ({ default: m.AnalyticsPage })));
const CRMPage = lazy(() => import('@/pages/CRMPage').then(m => ({ default: m.CRMPage })));
const SettingsPage = lazy(() => import('@/pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
const BillingPage = lazy(() => import('@/pages/BillingPage').then(m => ({ default: m.BillingPage })));

// Lazy: new Phase 1 pages
const IntegrationsPage = lazy(() => import('@/pages/IntegrationsPage').then(m => ({ default: m.IntegrationsPage })));
const AutomationsPage = lazy(() => import('@/pages/AutomationsPage').then(m => ({ default: m.AutomationsPage })));
const NotificationsPage = lazy(() => import('@/pages/NotificationsPage').then(m => ({ default: m.NotificationsPage })));
const RevenueStrategyPage = lazy(() => import('@/pages/RevenueStrategyPage').then(m => ({ default: m.RevenueStrategyPage })));
const ProspectDiscoveryPage = lazy(() => import('@/pages/ProspectDiscoveryPage').then(m => ({ default: m.ProspectDiscoveryPage })));
const OutreachIntelligencePage = lazy(() => import('@/pages/OutreachIntelligencePage').then(m => ({ default: m.OutreachIntelligencePage })));
const LinkedInOperationsPage = lazy(() => import('@/pages/LinkedInOperationsPage').then(m => ({ default: m.LinkedInOperationsPage })));
const ConversationIntelligencePage = lazy(() => import('@/pages/ConversationIntelligencePage').then(m => ({ default: m.ConversationIntelligencePage })));
const MeetingIntelligencePage = lazy(() => import('@/pages/MeetingIntelligencePage').then(m => ({ default: m.MeetingIntelligencePage })));
const ProposalIntelligencePage = lazy(() => import('@/pages/ProposalIntelligencePage').then(m => ({ default: m.ProposalIntelligencePage })));
const RevenueCommandCenterPage = lazy(() => import('@/pages/RevenueCommandCenterPage').then(m => ({ default: m.RevenueCommandCenterPage })));
const CustomerSuccessPage = lazy(() => import('@/pages/CustomerSuccessPage').then(m => ({ default: m.CustomerSuccessPage })));
const FinancePage = lazy(() => import('@/pages/FinancePage').then(m => ({ default: m.FinancePage })));
const AICEOPage = lazy(() => import('@/pages/AICEOPage').then(m => ({ default: m.AICEOPage })));
const WorkforcePage = lazy(() => import('@/pages/WorkforcePage').then(m => ({ default: m.WorkforcePage })));

// Lazy: Phase 18 — Enterprise Platform pages
const APIPlatformPage = lazy(() => import('@/pages/APIPlatformPage').then(m => ({ default: m.APIPlatformPage })));
const WebhookPlatformPage = lazy(() => import('@/pages/WebhookPlatformPage').then(m => ({ default: m.WebhookPlatformPage })));
const WhiteLabelPage = lazy(() => import('@/pages/WhiteLabelPage').then(m => ({ default: m.WhiteLabelPage })));
const EnterpriseAdminPage = lazy(() => import('@/pages/EnterpriseAdminPage').then(m => ({ default: m.EnterpriseAdminPage })));
const DeveloperPortalPage = lazy(() => import('@/pages/DeveloperPortalPage').then(m => ({ default: m.DeveloperPortalPage })));

// Lazy: Phase 19 — Production Operations pages
const ProductionOperationsPage = lazy(() => import('@/pages/ProductionOperationsPage').then(m => ({ default: m.ProductionOperationsPage })));
const SystemHealthPage = lazy(() => import('@/pages/SystemHealthPage').then(m => ({ default: m.SystemHealthPage })));
const MonitoringPage = lazy(() => import('@/pages/MonitoringPage').then(m => ({ default: m.MonitoringPage })));
const ObservabilityPage = lazy(() => import('@/pages/ObservabilityPage').then(m => ({ default: m.ObservabilityPage })));
const SecurityCenterPage = lazy(() => import('@/pages/SecurityCenterPage').then(m => ({ default: m.SecurityCenterPage })));
const FeatureFlagsPage = lazy(() => import('@/pages/FeatureFlagsPage').then(m => ({ default: m.FeatureFlagsPage })));
const DeploymentsPage = lazy(() => import('@/pages/DeploymentsPage').then(m => ({ default: m.DeploymentsPage })));
const BackupsPage = lazy(() => import('@/pages/BackupsPage').then(m => ({ default: m.BackupsPage })));
const QueueMonitorPage = lazy(() => import('@/pages/QueueMonitorPage').then(m => ({ default: m.QueueMonitorPage })));
const IncidentCenterPage = lazy(() => import('@/pages/IncidentCenterPage').then(m => ({ default: m.IncidentCenterPage })));

// Lazy: Phase 20 — Autonomous Revenue Execution Engine
const AutopilotPage = lazy(() => import('@/pages/AutopilotPage').then(m => ({ default: m.AutopilotPage })));

// Lazy: Phase 21 — Universal Integration Hub & Real-World Execution Layer
const ExecutionQueuePage = lazy(() => import('@/pages/ExecutionQueuePage').then(m => ({ default: m.ExecutionQueuePage })));
const BillingPaymentsPage = lazy(() => import('@/pages/BillingPaymentsPage').then(m => ({ default: m.BillingPaymentsPage })));
const BrowserDashboardPage = lazy(() => import('@/pages/BrowserDashboardPage').then(m => ({ default: m.BrowserDashboardPage })));
const LinkedInAutomationPage = lazy(() => import('@/pages/LinkedInAutomationPage').then(m => ({ default: m.LinkedInAutomationPage })));
const LinkedInAccountsPage = lazy(() => import('@/pages/LinkedInAccountsPage').then(m => ({ default: m.LinkedInAccountsPage })));
const ConversationInboxPage = lazy(() => import('@/pages/ConversationInboxPage').then(m => ({ default: m.ConversationInboxPage })));
const MeetingSchedulerPage = lazy(() => import('@/pages/MeetingSchedulerPage').then(m => ({ default: m.MeetingSchedulerPage })));
const IntegrationHealthPage = lazy(() => import('@/pages/IntegrationHealthPage').then(m => ({ default: m.IntegrationHealthPage })));

function PageFallback() {
  return (
    <div className="flex items-center justify-center h-full min-h-[400px]">
      <Spinner className="h-6 w-6" />
    </div>
  );
}

function Lazy({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageFallback />}>{children}</Suspense>;
}

function ProtectedApp({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <AppLayout>
        <ErrorBoundary>
          <Lazy>{children}</Lazy>
        </ErrorBoundary>
      </AppLayout>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <WorkspaceProvider>
          <BrowserRouter>
            <Routes>
              {/* Marketing routes */}
              <Route path="/" element={<Lazy><LandingPage /></Lazy>} />
              <Route path="/features" element={<Lazy><StaticPages.FeaturesPage /></Lazy>} />
              <Route path="/how-it-works" element={<Lazy><StaticPages.HowItWorksPage /></Lazy>} />
              <Route path="/pricing" element={<Lazy><StaticPages.PricingPage /></Lazy>} />
              <Route path="/resources" element={<Lazy><StaticPages.ResourcesPage /></Lazy>} />
              <Route path="/about" element={<Lazy><StaticPages.AboutPage /></Lazy>} />
              <Route path="/contact" element={<Lazy><StaticPages.ContactPage /></Lazy>} />
              <Route path="/privacy" element={<Lazy><StaticPages.PrivacyPage /></Lazy>} />
              <Route path="/terms" element={<Lazy><StaticPages.TermsPage /></Lazy>} />
              <Route path="/security" element={<Lazy><StaticPages.SecurityPage /></Lazy>} />
              <Route path="/help" element={<Lazy><StaticPages.HelpCenterPage /></Lazy>} />
              <Route path="/status" element={<Lazy><StaticPages.StatusPage /></Lazy>} />
              <Route path="/roadmap" element={<Lazy><StaticPages.RoadmapPage /></Lazy>} />
              <Route path="/demo" element={<Lazy><StaticPages.BookDemoPage /></Lazy>} />
              <Route path="/release-notes" element={<Lazy><StaticPages.ReleaseNotesPage /></Lazy>} />

              {/* Auth routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/verify-email" element={<VerifyEmailPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/invite" element={<InviteAcceptancePage />} />
              <Route path="/api/google/callback" element={<GoogleCallbackPage />} />

              {/* Onboarding */}
              <Route path="/onboarding" element={<Lazy><OnboardingPage /></Lazy>} />

              {/* Protected app routes — new navigation */}
              <Route path="/app" element={<ProtectedApp><DashboardPage /></ProtectedApp>} />
              <Route path="/app/campaigns" element={<Navigate to="/app/linkedin-automation" replace />} />
              <Route path="/app/prospects" element={<ProtectedApp><ProspectsPage /></ProtectedApp>} />
              <Route path="/app/inbox" element={<Navigate to="/app/conversations" replace />} />
              <Route path="/app/meetings" element={<ProtectedApp><MeetingsPage /></ProtectedApp>} />
              <Route path="/app/analytics" element={<ProtectedApp><AnalyticsPage /></ProtectedApp>} />
              <Route path="/app/crm" element={<ProtectedApp><CRMPage /></ProtectedApp>} />
              <Route path="/app/settings" element={<ProtectedApp><SettingsPage /></ProtectedApp>} />
              <Route path="/app/billing" element={<ProtectedApp><BillingPage /></ProtectedApp>} />
              <Route path="/app/integrations" element={<ProtectedApp><IntegrationsPage /></ProtectedApp>} />
              <Route path="/app/automations" element={<ProtectedApp><AutomationsPage /></ProtectedApp>} />
              <Route path="/app/notifications" element={<ProtectedApp><NotificationsPage /></ProtectedApp>} />
              <Route path="/app/revenue-strategy" element={<ProtectedApp><RevenueStrategyPage /></ProtectedApp>} />
              <Route path="/app/prospect-discovery" element={<ProtectedApp><ProspectDiscoveryPage /></ProtectedApp>} />
              <Route path="/app/outreach-intelligence" element={<ProtectedApp><OutreachIntelligencePage /></ProtectedApp>} />
              <Route path="/app/linkedin-operations" element={<ProtectedApp><LinkedInOperationsPage /></ProtectedApp>} />
              <Route path="/app/conversation-intelligence" element={<ProtectedApp><ConversationIntelligencePage /></ProtectedApp>} />
              <Route path="/app/meeting-intelligence" element={<ProtectedApp><MeetingIntelligencePage /></ProtectedApp>} />
              <Route path="/app/proposal-intelligence" element={<ProtectedApp><ProposalIntelligencePage /></ProtectedApp>} />
              <Route path="/app/revenue-command-center" element={<ProtectedApp><RevenueCommandCenterPage /></ProtectedApp>} />
              <Route path="/app/customer-success" element={<ProtectedApp><CustomerSuccessPage /></ProtectedApp>} />
              <Route path="/app/finance" element={<ProtectedApp><FinancePage /></ProtectedApp>} />
              <Route path="/app/ai-ceo" element={<ProtectedApp><AICEOPage /></ProtectedApp>} />
              <Route path="/app/workforce" element={<ProtectedApp><WorkforcePage /></ProtectedApp>} />

              {/* Phase 18 — Enterprise Platform routes */}
              <Route path="/app/api-platform" element={<ProtectedApp><APIPlatformPage /></ProtectedApp>} />
              <Route path="/app/webhooks" element={<ProtectedApp><WebhookPlatformPage /></ProtectedApp>} />
              <Route path="/app/white-label" element={<ProtectedApp><WhiteLabelPage /></ProtectedApp>} />
              <Route path="/app/enterprise-admin" element={<ProtectedApp><EnterpriseAdminPage /></ProtectedApp>} />
              <Route path="/app/developer-portal" element={<ProtectedApp><DeveloperPortalPage /></ProtectedApp>} />

              {/* Phase 19 — Production Operations */}
              <Route path="/app/production-operations" element={<ProtectedApp><ProductionOperationsPage /></ProtectedApp>} />
              <Route path="/app/system-health" element={<ProtectedApp><SystemHealthPage /></ProtectedApp>} />
              <Route path="/app/monitoring" element={<ProtectedApp><MonitoringPage /></ProtectedApp>} />
              <Route path="/app/observability" element={<ProtectedApp><ObservabilityPage /></ProtectedApp>} />
              <Route path="/app/security-center" element={<ProtectedApp><SecurityCenterPage /></ProtectedApp>} />
              <Route path="/app/feature-flags" element={<ProtectedApp><FeatureFlagsPage /></ProtectedApp>} />
              <Route path="/app/deployments" element={<ProtectedApp><DeploymentsPage /></ProtectedApp>} />
              <Route path="/app/backups" element={<ProtectedApp><BackupsPage /></ProtectedApp>} />
              <Route path="/app/queue-monitor" element={<ProtectedApp><QueueMonitorPage /></ProtectedApp>} />
              <Route path="/app/incident-center" element={<ProtectedApp><IncidentCenterPage /></ProtectedApp>} />

              {/* Phase 20 — Autonomous Revenue Execution Engine */}
              <Route path="/app/autopilot" element={<ProtectedApp><AutopilotPage /></ProtectedApp>} />

              {/* Phase 21 — Universal Integration Hub & Real-World Execution Layer */}
              <Route path="/app/execution-queue" element={<ProtectedApp><ExecutionQueuePage /></ProtectedApp>} />
              <Route path="/app/payments" element={<ProtectedApp><BillingPaymentsPage /></ProtectedApp>} />
              <Route path="/app/browser" element={<ProtectedApp><BrowserDashboardPage /></ProtectedApp>} />
              <Route path="/app/linkedin-automation" element={<ProtectedApp><LinkedInAutomationPage /></ProtectedApp>} />
              <Route path="/app/linkedin-accounts" element={<ProtectedApp><LinkedInAccountsPage /></ProtectedApp>} />
              <Route path="/app/conversations" element={<ProtectedApp><ConversationInboxPage /></ProtectedApp>} />
              <Route path="/app/meeting-scheduler" element={<ProtectedApp><MeetingSchedulerPage /></ProtectedApp>} />
              <Route path="/app/integration-health" element={<ProtectedApp><IntegrationHealthPage /></ProtectedApp>} />

              {/* Catch-all */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>

            <Toaster
              theme="dark"
              position="top-right"
              toastOptions={{
                style: {
                  background: 'rgb(29 34 49)',
                  border: '1px solid rgb(42 49 67)',
                  color: 'rgb(226 232 240)',
                  fontSize: '14px',
                  borderRadius: '12px',
                },
              }}
            />
          </BrowserRouter>
        </WorkspaceProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
