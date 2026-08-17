# Staging deployment steps

Target staging Supabase project: `vdiqfiuqckaxdjkadinu`.

Production project `aljpmtuekghwzrnuwkat` must not be used during V1 staging acceptance.

## 1. Install and validate locally (Windows)

```powershell
npm install
npm run build
cd workers\linkedin-browser-worker
npm install
npm run build
node --test dist/*.test.js
cd ..\..
```

The uploaded repository originally contained Windows `node_modules`; the generated ZIP intentionally excludes `node_modules`, so install dependencies fresh on the target machine.

## 2. Apply only the new V1 SQL

Historical Supabase migration history is known to be out of sync. Do **not** run a broad `supabase db push` until that historical drift is reconciled.

Open Supabase SQL Editor for **Yuktris Staging** and run the contents of:

`supabase/migrations/20260817180000_v1_notifications_and_calendar_idempotency.sql`

After the SQL succeeds, optionally synchronize only this migration-history entry:

```powershell
npx supabase link --project-ref vdiqfiuqckaxdjkadinu
npx supabase migration repair --status applied 20260817180000
```

## 3. Deploy changed Edge Functions to staging

```powershell
npx supabase functions deploy google-calendar-booking --project-ref vdiqfiuqckaxdjkadinu
npx supabase functions deploy linkedin-meeting-engine --project-ref vdiqfiuqckaxdjkadinu
npx supabase functions deploy meeting-scheduler --project-ref vdiqfiuqckaxdjkadinu
npx supabase functions deploy webhook-dispatcher --project-ref vdiqfiuqckaxdjkadinu
```

Milestone 1 functions `provider-webhook` and `webhook-receiver` were already deployed to staging; redeploy them only if your checkout differs from the deployed commit.

## 4. Git / Railway staging

Use branch `development`. Railway `Staging` should track `development`; Railway `production` should track `main`.

```powershell
git add .
git commit -m "Yuktris V1 consolidated revenue and meeting pipeline"
git push origin development
```

Verify Railway **Staging/Yuktris** resolves to staging Supabase project `vdiqfiuqckaxdjkadinu` before any live acceptance.

## 5. Do not promote to production yet

Complete `V1_ACCEPTANCE_CHECKLIST.md` on staging first.
