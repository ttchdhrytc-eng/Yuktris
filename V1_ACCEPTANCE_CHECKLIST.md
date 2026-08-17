# Yuktris V1 staging acceptance checklist

## Environment

- [ ] Frontend staging loads and uses staging Supabase `vdiqfiuqckaxdjkadinu`
- [ ] Railway Staging/Yuktris tracks `development`
- [ ] Production remains on `main`
- [ ] New V1 SQL migration applied to staging only
- [ ] Changed Edge Functions deployed to staging

## Business / AI

- [ ] New workspace signup succeeds
- [ ] Website research produces persisted real business analysis
- [ ] ICP generation produces real structured ICPs; no mock fallback displayed
- [ ] Revenue Strategy creates structured persisted strategy
- [ ] Prospect Discovery returns real persisted prospects
- [ ] Outreach Intelligence produces prospect-specific research/personalization

## LinkedIn Cloud Agent

- [ ] Existing connected account reuses persistent Context without unnecessary login
- [ ] Identity attestation remains valid
- [ ] Sales Navigator bounded search returns normalized candidates
- [ ] Safety preflight blocks disallowed hours/rate/cooldown/challenge states
- [ ] Controlled connection-request live acceptance is repeated after current dialog-handler fix if permitted by your test policy
- [ ] Message/follow-up behavior is tested only against a controlled account/test thread
- [ ] No duplicate write can occur for one semantic action/idempotency key

## Conversation intelligence

- [ ] Inbound prospect message is persisted once
- [ ] Duplicate inbound message is suppressed
- [ ] AI intent, objection, buying-stage, score and suggested reply are persisted
- [ ] Meeting-ready conversation creates a meeting request/candidate
- [ ] Ambiguous meeting time does **not** invent a booking

## Google Calendar / meeting booking

- [ ] Connect Google using Calendar scopes
- [ ] FreeBusy rejects a genuine busy interval
- [ ] Available slots reflect connected Calendar availability
- [ ] Prospect with explicit confirmed date/time creates a real Google Calendar event
- [ ] Prospect attendee receives Calendar invitation
- [ ] Real Google Meet link is returned and persisted
- [ ] Meeting appears in `/app/meetings` / meeting intelligence state
- [ ] Reschedule updates the same Google event
- [ ] Cancellation deletes/cancels the Google event
- [ ] In-app `meeting_booked` notification appears

## Safety / tenancy

- [ ] Webhook requests without valid authentication/signature fail closed
- [ ] Cross-workspace webhook request is rejected
- [ ] `webhook-dispatcher` rejects unauthenticated requests
- [ ] Workspace RLS prevents data from another test workspace being read
- [ ] No service-role, OAuth refresh token, Browserbase key or session cookie appears in browser-visible logs

## Launch gate

Do not call V1 production-ready until all required staging items above pass. Any third-party account challenge or restriction should pause the relevant agent rather than be bypassed.
