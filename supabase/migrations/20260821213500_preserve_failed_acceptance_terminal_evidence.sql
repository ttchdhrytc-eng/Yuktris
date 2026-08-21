BEGIN;

/* Preserve the failed attempt and its audit rows; remove only future execution eligibility. */
UPDATE public.linkedin_execution_jobs
SET scheduled_at=NULL,
    max_retries=least(max_retries,retry_count),
    updated_at=now()
WHERE id='51ccbcf6-1361-4da7-9f09-f080d11b8495'
  AND status='failed'
  AND completed_at IS NOT NULL;

UPDATE public.browser_execution_queue
SET scheduled_at=NULL,
    next_retry_at=NULL,
    max_retries=least(max_retries,retry_count),
    updated_at=now()
WHERE id='a2f2bf5d-ed02-47d4-ad45-9b1850f7853c'
  AND status='failed';

COMMIT;
