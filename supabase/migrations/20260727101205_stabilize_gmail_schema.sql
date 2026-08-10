/*
# Gmail Stabilization Schema Migration

## Purpose
Adds columns to support: archive state, message ID header for reply threading,
attachment metadata, HTML email body, pagination cursors, and incremental sync tracking.

## Changes to gmail_messages
- `is_archived` (boolean, default false) — archive state without deleting data
- `message_id_header` (text, nullable) — RFC 2822 Message-ID header for proper reply threading
- `in_reply_to` (text, nullable) — RFC 2822 In-Reply-To header
- `references_header` (text, nullable) — RFC 2822 References header (renamed from "references" which is a reserved keyword)
- `body_html` (text, nullable) — HTML email body content
- `body_plain` (text, nullable) — Plain text email body content
- `has_attachments` (boolean, default false) — quick attachment check flag
- `attachments` (jsonb, default '[]') — attachment metadata array

## Changes to gmail_threads
- `message_count` (integer, default 0) — number of messages in thread
- `last_message_snippet` (text, nullable) — snippet of most recent message

## Changes to gmail_accounts
- `next_page_token` (text, nullable) — pagination cursor for continuing sync
- `full_sync_completed` (boolean, default false) — whether initial full sync is done
- `last_history_id` (text, nullable) — last processed history ID for incremental sync
- `sync_error` (text, nullable) — last sync error message for retry logic
- `sync_retry_count` (integer, default 0) — retry counter for failed syncs

## Security
- No new tables created
- No RLS policy changes — existing policies cover new columns automatically
- All new columns have safe defaults or are nullable

## Important Notes
1. This migration is additive only — no columns are dropped, renamed, or type-changed
2. Existing data is preserved — new columns default to safe values
3. The `history_id` column already exists on gmail_accounts and is used as the
   starting point for incremental sync; `last_history_id` tracks the last
   PROCESSED history ID to avoid reprocessing
*/

-- gmail_messages: new columns for archive, threading, attachments, HTML
ALTER TABLE gmail_messages
  ADD COLUMN IF NOT EXISTS is_archived boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS message_id_header text,
  ADD COLUMN IF NOT EXISTS in_reply_to text,
  ADD COLUMN IF NOT EXISTS references_header text,
  ADD COLUMN IF NOT EXISTS body_html text,
  ADD COLUMN IF NOT EXISTS body_plain text,
  ADD COLUMN IF NOT EXISTS has_attachments boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS attachments jsonb DEFAULT '[]'::jsonb;

-- gmail_threads: new columns for message count and snippet
ALTER TABLE gmail_threads
  ADD COLUMN IF NOT EXISTS message_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_message_snippet text;

-- gmail_accounts: new columns for pagination, incremental sync, retry
ALTER TABLE gmail_accounts
  ADD COLUMN IF NOT EXISTS next_page_token text,
  ADD COLUMN IF NOT EXISTS full_sync_completed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_history_id text,
  ADD COLUMN IF NOT EXISTS sync_error text,
  ADD COLUMN IF NOT EXISTS sync_retry_count integer DEFAULT 0;

-- Index for archived message filtering
CREATE INDEX IF NOT EXISTS idx_gmail_messages_archived
  ON gmail_messages (gmail_account_id, is_archived)
  WHERE is_archived = true;

-- Index for efficient incremental sync lookups
CREATE INDEX IF NOT EXISTS idx_gmail_accounts_history
  ON gmail_accounts (last_history_id);
