# Intentional V1 patch manifest

The uploaded source tree had noisy cross-platform Git metadata/line-ending changes, so this manifest is the source of truth for the consolidated edits made in this V1 pass.

## Frontend / services

- `.env.example`
- `src/components/layout/Sidebar.tsx`
- `src/pages/MeetingSchedulerPage.tsx`
- `src/hooks/useLinkedInBrowser.ts`
- `src/hooks/useWebhookPlatform.ts`
- `src/services/activation/ActivationService.ts`
- `src/services/conversation-intelligence/ConversationIntelligenceService.ts`
- `src/services/meeting-intelligence/MeetingIntelligenceService.ts`
- `src/services/meetings/MeetingBookingEngine.ts`
- `src/types/conversation-intelligence.ts`

## Supabase functions

- `supabase/functions/_shared/googleCalendar.ts` (new)
- `supabase/functions/google-calendar-booking/index.ts` (new)
- `supabase/functions/linkedin-meeting-engine/index.ts`
- `supabase/functions/meeting-scheduler/index.ts`
- `supabase/functions/webhook-dispatcher/index.ts`

## Supabase migration

- `supabase/migrations/20260817180000_v1_notifications_and_calendar_idempotency.sql` (new)

## Documentation

- `CHANGES_V1.md`
- `V1_SCOPE.md`
- `ENV_REQUIRED.md`
- `DEPLOYMENT_STEPS.md`
- `V1_ACCEPTANCE_CHECKLIST.md`
- `KNOWN_LIMITATIONS.md`
- `PATCH_MANIFEST.md`
