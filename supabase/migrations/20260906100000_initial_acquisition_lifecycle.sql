-- Existing ICPs remain in maintenance mode. Only a new activation or material
-- targeting change enters the bounded initial-acquisition lifecycle.
ALTER TABLE public.icps
  ADD COLUMN IF NOT EXISTS acquisition_phase text NOT NULL DEFAULT 'maintenance',
  ADD COLUMN IF NOT EXISTS initial_acquisition_batches_completed integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS starter_ready_target integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS max_initial_acquisition_batches integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS initial_acquisition_interval_minutes integer NOT NULL DEFAULT 10;

ALTER TABLE public.icps DROP CONSTRAINT IF EXISTS icps_acquisition_phase_check;
ALTER TABLE public.icps ADD CONSTRAINT icps_acquisition_phase_check
  CHECK (acquisition_phase IN ('initial_acquisition','maintenance'));
ALTER TABLE public.icps DROP CONSTRAINT IF EXISTS icps_initial_acquisition_bounds_check;
ALTER TABLE public.icps ADD CONSTRAINT icps_initial_acquisition_bounds_check CHECK (
  initial_acquisition_batches_completed BETWEEN 0 AND 100 AND
  starter_ready_target BETWEEN 1 AND 10 AND
  max_initial_acquisition_batches BETWEEN 1 AND 5 AND
  initial_acquisition_interval_minutes BETWEEN 5 AND 60
);
