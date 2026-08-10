/*
# LinkedIn Account Connection State & Diagnostics

## Summary
Adds connection lifecycle columns to `linkedin_accounts` to support the proper
"Connect LinkedIn" flow. The account record should only become CONNECTED after
actual browser authentication + session validation succeeds — not merely because
a row was inserted.

## Changes
- Add `connection_state` column: tracks the full connection lifecycle
  (pending, authenticating, requires_action, connected, session_expired,
  session_invalid, restricted, disconnected, failed)
- Add `last_validated_at`: when the session was last verified to work
- Add `last_error`: safe error message (never credentials) for failed connections
- Add `dry_run_enabled`: per-account dry run flag for safe mode

## Security
- No credentials are stored in these columns
- `last_error` contains only safe, user-facing error messages
- RLS policies already exist on `linkedin_accounts` and cover the new columns

## Notes
- The existing `status` and `session_status` columns are preserved for backward
  compatibility. `connection_state` is the new primary state field used by the UI.
- The existing `connection_status` column (added in Phase 21.8) is also preserved.
  `connection_state` provides a more granular lifecycle that includes
  `authenticating` and `requires_action` states.
*/

ALTER TABLE linkedin_accounts
  ADD COLUMN IF NOT EXISTS connection_state text NOT NULL DEFAULT 'disconnected'
    CHECK (connection_state IN (
      'pending',
      'authenticating',
      'requires_action',
      'connected',
      'session_expired',
      'session_invalid',
      'restricted',
      'disconnected',
      'failed'
    ));

ALTER TABLE linkedin_accounts
  ADD COLUMN IF NOT EXISTS last_validated_at timestamptz;

ALTER TABLE linkedin_accounts
  ADD COLUMN IF NOT EXISTS last_error text;

ALTER TABLE linkedin_accounts
  ADD COLUMN IF NOT EXISTS dry_run_enabled boolean NOT NULL DEFAULT false;