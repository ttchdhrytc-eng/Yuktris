/*
# Fix context entity_id column types to text

## Overview
The context_profiles and context_cache tables were created with entity_id as
uuid type. However, the TypeScript types (ContextProfileRecord.entity_id and
ContextCacheRecord.entity_id) are typed as `string | null`, and the service
code (ContextVersionManager.createProfile, ContextCache.set) passes arbitrary
string values as entity_id — not necessarily UUIDs. For example, entity_id can
be a company name, a CRM record ID, or any string identifier from upstream
systems. Using uuid type would cause runtime errors when non-UUID strings are
inserted.

## Changes
- ALTER context_profiles.entity_id from uuid to text
- ALTER context_cache.entity_id from uuid to text
- No data changes (tables are empty)
- Indexes are automatically maintained by Postgres through the type change
*/

ALTER TABLE context_profiles ALTER COLUMN entity_id TYPE text;
ALTER TABLE context_cache ALTER COLUMN entity_id TYPE text;
