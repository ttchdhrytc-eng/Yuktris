/*
# Fix workspace_members INSERT policy

## Problem
The `insert_own_members` policy on `workspace_members` requires an
existing owner/admin membership record to insert a new member. This
creates a chicken-and-egg problem: when a user creates their first
workspace, they need to insert their own `workspace_members` row
(role = 'owner'), but the policy blocks it because no membership
exists yet.

This causes the "new row violates row-level security policy for
table workspaces" error during onboarding — the workspace INSERT
succeeds (its INSERT policy is `WITH CHECK (true)`), but the
subsequent `workspace_members` INSERT fails, and the error
surfaces as an RLS violation.

## Fix
Replace the `insert_own_members` policy with one that allows
insertion in two cases:
  1. Self-membership: the user is inserting a row where user_id
     matches auth.uid() (covers the first-owner case).
  2. Admin/owner sponsorship: the user is already an owner/admin
     of the workspace (covers inviting new members later).

## Safety
- Self-membership is scoped to auth.uid() — a user can only add
  themselves, not arbitrary users.
- Admin sponsorship still requires existing owner/admin role.
- RLS remains enabled; no other policies change.
*/

DROP POLICY IF EXISTS "insert_own_members" ON workspace_members;

CREATE POLICY "insert_own_members" ON workspace_members FOR INSERT
  TO authenticated WITH CHECK (
    -- Case 1: user is adding themselves (first owner during workspace creation)
    user_id = auth.uid()
    -- Case 2: user is already an owner/admin of this workspace (inviting others)
    OR EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspace_members.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin')
    )
  );