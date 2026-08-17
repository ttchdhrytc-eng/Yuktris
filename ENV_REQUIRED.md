# Environment / secret requirements

## Frontend

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## Supabase Edge Functions

Supabase supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to deployed functions. Do not expose the service-role key to the frontend.

Google Calendar booking requires the existing Google OAuth configuration:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

The Calendar helper can also read those through the existing `get_google_secret` RPC if that is how the workspace is configured.

The connected Google account must include one of these scopes:

- `https://www.googleapis.com/auth/calendar`
- `https://www.googleapis.com/auth/calendar.events`

LinkedIn worker deployment continues to require the existing staging Browserbase/Supabase/session-encryption variables already configured in Railway. No new LinkedIn secret is introduced by this patch.

AI functionality uses Yuktris's existing AI Gateway/provider registry. Configure at least one supported provider for the workspace.
