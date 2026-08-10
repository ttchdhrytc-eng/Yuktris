-- Fix: Add 'closing' to browser_workers status constraint
-- The set_browser_worker_closing RPC sets status='closing' but the CHECK constraint
-- only allows idle/busy/offline/error/maintenance. Add 'closing' to fix.

ALTER TABLE browser_workers DROP CONSTRAINT IF EXISTS browser_workers_status_check;
ALTER TABLE browser_workers ADD CONSTRAINT browser_workers_status_check 
  CHECK (status = ANY (ARRAY['idle'::text, 'busy'::text, 'offline'::text, 'error'::text, 'maintenance'::text, 'closing'::text]));
