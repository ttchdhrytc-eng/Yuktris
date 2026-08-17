# Yuktris V1 scope

Yuktris V1 is the autonomous B2B revenue workflow built around the current production routes and services:

1. Business onboarding and company research
2. AI-generated ICPs
3. Revenue strategy
4. Prospect discovery and scoring
5. Outreach intelligence/personalization
6. LinkedIn Cloud Agent execution queue with persistent Context, identity attestation, safety preflight, rate limits and challenge handling
7. Conversation ingestion and AI conversation intelligence
8. Meeting-intent detection and qualification
9. Google Calendar availability, event creation, Google Meet, attendee invite, reschedule/cancel
10. In-app notifications and meeting state

The active V1 services are the newer `revenue-strategy`, `prospect-discovery-engine`, `outreach-intelligence`, `conversation-intelligence`, `meeting-intelligence`, `activation`, and LinkedIn browser-worker paths.

Legacy phase/demo modules remain in the repository for compatibility but are not part of the certified V1 runtime. In particular, older pages/services containing `MOCK_*` data should not be treated as production intelligence unless they are explicitly rewired into the active V1 routes later.

Google Ads and Meta Ads are intentionally out of V1 scope.
