# Yuktris V1 consolidated changes

This repository starts from `development` commit `5e107dc`, which already contains the Milestone 1 webhook hardening and real ICP generation work.

## Consolidated V1 additions

- Added authenticated server-side Google Calendar helper using existing `google_accounts` / `oauth_tokens`.
- Added `google-calendar-booking` Edge Function for connection checks, FreeBusy, create/update/delete events, Google Meet generation and attendee updates.
- Reworked `linkedin-meeting-engine` to use real Google Calendar/Meet instead of fabricated meeting URLs.
- Reworked `meeting-scheduler` to authenticate workspace access, use real FreeBusy, create real Calendar events, send attendee invitations, reschedule/cancel, and write idempotent notifications.
- Updated Meeting Intelligence to use real Google availability and real Calendar bookings.
- Added conservative autonomous conversation-to-meeting handoff: exact meeting booking happens only when conversation AI extracts an explicit prospect-confirmed ISO date/time with high confidence. Ambiguous timing creates meeting intent/candidates instead of inventing a time.
- Added current conversation-intelligence scheduling output contract.
- Secured `webhook-dispatcher` with workspace authorization and idempotent workspace-scoped replay/delivery.
- Updated frontend webhook replay to use the authenticated user's JWT rather than an anon key.
- Removed silent fake fallback behavior from activation/business/ICP generation paths so customer-facing generation fails visibly instead of returning fabricated data.
- Updated calendar connection hooks to use the existing Google OAuth account records.
- Added unified `notifications` table migration expected by the current Notifications UI, plus calendar-event idempotency index.
- Updated V1 sidebar to expose the real Revenue Strategy → Prospect Discovery → Outreach Intelligence → LinkedIn Agent → Conversations → Meeting Intelligence → Meetings → Autopilot flow and restored Yuktris product naming.

## Preserved deliberately

- Existing LinkedIn persistent Browserbase Context architecture
- Canonical identity binding and Context identity attestation
- Queue/idempotency model
- Write safety preflight, rate limits, cooldowns, working hours and challenge/restriction handling
- Existing Sales Navigator extraction and connection-dialog fixes

These areas should only change after a concrete live regression is reproduced.
