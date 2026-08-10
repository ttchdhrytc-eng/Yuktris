/*
# Create Gmail Integration Schema

## Summary
Creates three new tables to support Gmail integration: `gmail_accounts`,
`gmail_messages`, and `gmail_threads`. These tables store synced Gmail data
linked to existing Google OAuth accounts and workspaces.

## New Tables

### 1. `gmail_accounts`
- `id` (uuid, PK) — unique Gmail account record
- `workspace_id` (uuid, FK → workspaces) — workspace ownership
- `google_account_id` (uuid, FK → google_accounts) — linked OAuth account
- `email` (text) — Gmail email address
- `history_id` (text) — Gmail history ID for incremental sync
- `sync_status` (text) — 'idle' | 'syncing' | 'error'
- `last_synced_at` (timestamptz) — last successful sync time
- `created_at` / `updated_at` (timestamptz) — timestamps

### 2. `gmail_messages`
- `id` (uuid, PK) — unique message record
- `gmail_account_id` (uuid, FK → gmail_accounts) — owning Gmail account
- `google_message_id` (text) — Gmail API message ID
- `thread_id` (text) — Gmail thread ID
- `subject` (text) — email subject
- `from_email` (text) — sender email
- `to_email` (text) — recipient email(s)
- `snippet` (text) — short preview
- `label_ids` (text[]) — Gmail label IDs
- `received_at` (timestamptz) — message date
- `is_read` (boolean) — read status
- `is_starred` (boolean) — starred status
- `created_at` (timestamptz) — record creation time

### 3. `gmail_threads`
- `id` (uuid, PK) — unique thread record
- `gmail_account_id` (uuid, FK → gmail_accounts) — owning Gmail account
- `google_thread_id` (text) — Gmail thread ID
- `subject` (text) — thread subject
- `participants` (text[]) — participant emails
- `last_message_at` (timestamptz) — last message time

## Security
- RLS enabled on all three tables.
- Policies scope access through workspace membership using `is_workspace_member()`.
- All policies target `TO authenticated` (app has sign-in).
- 4 policies per table (SELECT, INSERT, UPDATE, DELETE).

## Indexes
- `gmail_messages` indexed on `gmail_account_id`, `received_at`, `thread_id`, `is_read`
- `gmail_threads` indexed on `gmail_account_id`, `last_message_at`
- `gmail_accounts` indexed on `workspace_id`, `google_account_id`
*/

-- ============================================================
-- gmail_accounts
-- ============================================================

CREATE TABLE IF NOT EXISTS public.gmail_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  google_account_id uuid NOT NULL REFERENCES public.google_accounts(id) ON DELETE CASCADE,
  email text NOT NULL,
  history_id text,
  sync_status text NOT NULL DEFAULT 'idle',
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.gmail_accounts ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_gmail_accounts_workspace ON public.gmail_accounts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_gmail_accounts_google_account ON public.gmail_accounts(google_account_id);

DROP POLICY IF EXISTS "select_gmail_accounts" ON public.gmail_accounts;
CREATE POLICY "select_gmail_accounts" ON public.gmail_accounts
  FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "insert_gmail_accounts" ON public.gmail_accounts;
CREATE POLICY "insert_gmail_accounts" ON public.gmail_accounts
  FOR INSERT TO authenticated WITH CHECK (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "update_gmail_accounts" ON public.gmail_accounts;
CREATE POLICY "update_gmail_accounts" ON public.gmail_accounts
  FOR UPDATE TO authenticated USING (public.is_workspace_member(workspace_id)) WITH CHECK (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "delete_gmail_accounts" ON public.gmail_accounts;
CREATE POLICY "delete_gmail_accounts" ON public.gmail_accounts
  FOR DELETE TO authenticated USING (public.is_workspace_member(workspace_id));

-- ============================================================
-- gmail_messages
-- ============================================================

CREATE TABLE IF NOT EXISTS public.gmail_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gmail_account_id uuid NOT NULL REFERENCES public.gmail_accounts(id) ON DELETE CASCADE,
  google_message_id text NOT NULL,
  thread_id text,
  subject text,
  from_email text,
  to_email text,
  snippet text,
  label_ids text[] DEFAULT '{}',
  received_at timestamptz,
  is_read boolean NOT NULL DEFAULT false,
  is_starred boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.gmail_messages ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_gmail_messages_account ON public.gmail_messages(gmail_account_id);
CREATE INDEX IF NOT EXISTS idx_gmail_messages_received ON public.gmail_messages(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_gmail_messages_thread ON public.gmail_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_gmail_messages_unread ON public.gmail_messages(gmail_account_id, is_read);
CREATE UNIQUE INDEX IF NOT EXISTS idx_gmail_messages_google_id ON public.gmail_messages(gmail_account_id, google_message_id);

DROP POLICY IF EXISTS "select_gmail_messages" ON public.gmail_messages;
CREATE POLICY "select_gmail_messages" ON public.gmail_messages
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.gmail_accounts ga
      WHERE ga.id = gmail_messages.gmail_account_id
      AND public.is_workspace_member(ga.workspace_id))
  );

DROP POLICY IF EXISTS "insert_gmail_messages" ON public.gmail_messages;
CREATE POLICY "insert_gmail_messages" ON public.gmail_messages
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.gmail_accounts ga
      WHERE ga.id = gmail_messages.gmail_account_id
      AND public.is_workspace_member(ga.workspace_id))
  );

DROP POLICY IF EXISTS "update_gmail_messages" ON public.gmail_messages;
CREATE POLICY "update_gmail_messages" ON public.gmail_messages
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.gmail_accounts ga
      WHERE ga.id = gmail_messages.gmail_account_id
      AND public.is_workspace_member(ga.workspace_id))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.gmail_accounts ga
      WHERE ga.id = gmail_messages.gmail_account_id
      AND public.is_workspace_member(ga.workspace_id))
  );

DROP POLICY IF EXISTS "delete_gmail_messages" ON public.gmail_messages;
CREATE POLICY "delete_gmail_messages" ON public.gmail_messages
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.gmail_accounts ga
      WHERE ga.id = gmail_messages.gmail_account_id
      AND public.is_workspace_member(ga.workspace_id))
  );

-- ============================================================
-- gmail_threads
-- ============================================================

CREATE TABLE IF NOT EXISTS public.gmail_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gmail_account_id uuid NOT NULL REFERENCES public.gmail_accounts(id) ON DELETE CASCADE,
  google_thread_id text NOT NULL,
  subject text,
  participants text[] DEFAULT '{}',
  last_message_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.gmail_threads ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_gmail_threads_account ON public.gmail_threads(gmail_account_id);
CREATE INDEX IF NOT EXISTS idx_gmail_threads_last_message ON public.gmail_threads(last_message_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_gmail_threads_google_id ON public.gmail_threads(gmail_account_id, google_thread_id);

DROP POLICY IF EXISTS "select_gmail_threads" ON public.gmail_threads;
CREATE POLICY "select_gmail_threads" ON public.gmail_threads
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.gmail_accounts ga
      WHERE ga.id = gmail_threads.gmail_account_id
      AND public.is_workspace_member(ga.workspace_id))
  );

DROP POLICY IF EXISTS "insert_gmail_threads" ON public.gmail_threads;
CREATE POLICY "insert_gmail_threads" ON public.gmail_threads
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.gmail_accounts ga
      WHERE ga.id = gmail_threads.gmail_account_id
      AND public.is_workspace_member(ga.workspace_id))
  );

DROP POLICY IF EXISTS "update_gmail_threads" ON public.gmail_threads;
CREATE POLICY "update_gmail_threads" ON public.gmail_threads
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.gmail_accounts ga
      WHERE ga.id = gmail_threads.gmail_account_id
      AND public.is_workspace_member(ga.workspace_id))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.gmail_accounts ga
      WHERE ga.id = gmail_threads.gmail_account_id
      AND public.is_workspace_member(ga.workspace_id))
  );

DROP POLICY IF EXISTS "delete_gmail_threads" ON public.gmail_threads;
CREATE POLICY "delete_gmail_threads" ON public.gmail_threads
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.gmail_accounts ga
      WHERE ga.id = gmail_threads.gmail_account_id
      AND public.is_workspace_member(ga.workspace_id))
  );

-- ============================================================
-- updated_at triggers
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_gmail_account_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_gmail_account_updated ON public.gmail_accounts;
CREATE TRIGGER trg_gmail_account_updated
  BEFORE UPDATE ON public.gmail_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_gmail_account_updated_at();
