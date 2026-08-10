/*
# Fix linkedin_accounts status CHECK constraint

## Summary
The `status` column CHECK constraint only allows ['connected', 'disconnected', 'error'],
but the application code uses additional states: 'active', 'paused', 'restricted',
'banned', 'expired', 'pending_login'. This causes INSERT/UPDATE failures.

## Changes
- Drop the old CHECK constraint
- Add a new CHECK constraint that includes all valid status values used by the application

## Notes
- The `connection_state` column (added in the previous migration) is the primary
  state field. The `status` column is used for account lifecycle state.
*/

ALTER TABLE linkedin_accounts DROP CONSTRAINT IF EXISTS linkedin_accounts_status_check;

ALTER TABLE linkedin_accounts ADD CONSTRAINT linkedin_accounts_status_check
  CHECK (status IN (
    'active', 'paused', 'restricted', 'banned', 'expired',
    'pending_login', 'connected', 'disconnected', 'error'
  ));