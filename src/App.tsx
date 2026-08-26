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
const CampaignsPage = lazy(() => import('@/pages/CampaignsPage').then(m => ({ default: m.CampaignsPage })));
const ConnectionsPage = lazy(() => import('@/pages/ConnectionsPage').then(m => ({ default: m.ConnectionsPage })));
const ProspectsPage = lazy(() => import('@/pages/ProspectsPage').then(m => ({ default: m.ProspectsPage })));
const MeetingsPage = lazy(() => import('@/pages/MeetingsPage').then(m => ({ default: m.MeetingsPage })));
const SettingsPage = lazy(() => import('@/pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
const BillingPage = lazy(() => import('@/pages/BillingPage').then(m => ({ default: m.BillingPage })));

// Lazy: new Phase 1 pages

// Lazy: Phase 18 — Enterprise Platform pages

// Lazy: Phase 19 — Production Operations pages

// Lazy: Phase 20 — Autonomous Revenue Execution Engine

// Lazy: Phase 21 — Universal Integration Hub & Real-World Execution Layer
const ConversationInboxPage = lazy(() => import('@/pages/ConversationInboxPage').then(m => ({ default: m.ConversationInboxPage })));

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
    <ErrorBoundary>
      <ProtectedRoute>
        <AppLayout>
          <Lazy>{children}</Lazy>
        </AppLayout>
      </ProtectedRoute>
    </ErrorBoundary>
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
              <Route path="/app/campaigns" element={<ProtectedApp><CampaignsPage /></ProtectedApp>} />
              <Route path="/app/audience" element={<Navigate to="/app/prospects" replace />} />
              <Route path="/app/prospects" element={<ProtectedApp><ProspectsPage /></ProtectedApp>} />
              <Route path="/app/inbox" element={<Navigate to="/app/conversations" replace />} />
              <Route path="/app/meetings" element={<ProtectedApp><MeetingsPage /></ProtectedApp>} />
              <Route path="/app/analytics" element={<Navigate to="/app" replace />} />
              <Route path="/app/crm" element={<Navigate to="/app" replace />} />
              <Route path="/app/settings" element={<ProtectedApp><SettingsPage /></ProtectedApp>} />
              <Route path="/app/billing" element={<ProtectedApp><BillingPage /></ProtectedApp>} />
              <Route path="/app/integrations" element={<Navigate to="/app/settings" replace />} />
              <Route path="/app/connections" element={<ProtectedApp><ConnectionsPage /></ProtectedApp>} />
              <Route path="/app/automations" element={<Navigate to="/app" replace />} />
              <Route path="/app/notifications" element={<Navigate to="/app/settings" replace />} />
              <Route path="/app/revenue-strategy" element={<Navigate to="/app" replace />} />
              <Route path="/app/prospect-discovery" element={<Navigate to="/app/prospects" replace />} />
              <Route path="/app/outreach-intelligence" element={<Navigate to="/app" replace />} />
              <Route path="/app/linkedin-operations" element={<Navigate to="/app/connections" replace />} />
              <Route path="/app/conversation-intelligence" element={<Navigate to="/app/conversations" replace />} />
              <Route path="/app/meeting-intelligence" element={<Navigate to="/app/meetings" replace />} />
              <Route path="/app/proposal-intelligence" element={<Navigate to="/app" replace />} />
              <Route path="/app/revenue-command-center" element={<Navigate to="/app" replace />} />
              <Route path="/app/customer-success" element={<Navigate to="/app" replace />} />
              <Route path="/app/finance" element={<Navigate to="/app" replace />} />
              <Route path="/app/ai-ceo" element={<Navigate to="/app" replace />} />
              <Route path="/app/workforce" element={<Navigate to="/app" replace />} />

              {/* Phase 18 — Enterprise Platform routes */}
              <Route path="/app/api-platform" element={<Navigate to="/app" replace />} />
              <Route path="/app/webhooks" element={<Navigate to="/app" replace />} />
              <Route path="/app/white-label" element={<Navigate to="/app" replace />} />
              <Route path="/app/enterprise-admin" element={<Navigate to="/app" replace />} />
              <Route path="/app/developer-portal" element={<Navigate to="/app" replace />} />

              {/* Phase 19 — Production Operations */}
              <Route path="/app/production-operations" element={<Navigate to="/app" replace />} />
              <Route path="/app/system-health" element={<Navigate to="/app" replace />} />
              <Route path="/app/monitoring" element={<Navigate to="/app" replace />} />
              <Route path="/app/observability" element={<Navigate to="/app" replace />} />
              <Route path="/app/security-center" element={<Navigate to="/app" replace />} />
              <Route path="/app/feature-flags" element={<Navigate to="/app" replace />} />
              <Route path="/app/deployments" element={<Navigate to="/app" replace />} />
              <Route path="/app/backups" element={<Navigate to="/app" replace />} />
              <Route path="/app/queue-monitor" element={<Navigate to="/app" replace />} />
              <Route path="/app/incident-center" element={<Navigate to="/app" replace />} />

              {/* Phase 20 — Autonomous Revenue Execution Engine */}
              <Route path="/app/autopilot" element={<Navigate to="/app" replace />} />

              {/* Phase 21 — Universal Integration Hub & Real-World Execution Layer */}
              <Route path="/app/execution-queue" element={<Navigate to="/app" replace />} />
              <Route path="/app/payments" element={<Navigate to="/app/billing" replace />} />
              <Route path="/app/browser" element={<Navigate to="/app" replace />} />
              <Route path="/app/linkedin-automation" element={<Navigate to="/app/connections" replace />} />
              <Route path="/app/linkedin-accounts" element={<Navigate to="/app/connections" replace />} />
              <Route path="/app/conversations" element={<ProtectedApp><ConversationInboxPage /></ProtectedApp>} />
              <Route path="/app/meeting-scheduler" element={<Navigate to="/app/meetings" replace />} />
              <Route path="/app/integration-health" element={<Navigate to="/app/connections" replace />} />

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
