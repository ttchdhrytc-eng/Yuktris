# Known limitations / live acceptance boundaries

- The LinkedIn browser-worker test suite is green locally, but a final successful live controlled write still depends on LinkedIn's current UI/account state and third-party platform policy. Yuktris must stop on challenges/restrictions rather than bypass them.
- Google Calendar/Meet creation requires a connected Google OAuth account with Calendar scope. This must be validated with a real staging account.
- Historical Supabase migration-history drift predates this V1 patch. The deployment guide intentionally avoids a broad `db push`.
- Legacy phase/demo pages and services containing mock data remain in source for compatibility but are outside the active V1 route chain documented in `V1_SCOPE.md`.
- Google Ads and Meta Ads are not included in this V1 package.
- Full repository standalone TypeScript checking has pre-existing errors in unrelated legacy modules; changed V1 paths should be validated by the target Windows build and the acceptance checklist before promotion.
