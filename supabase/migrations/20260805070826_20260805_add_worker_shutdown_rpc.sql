-- Mark browser worker as closing (for worker shutdown)
CREATE OR REPLACE FUNCTION public.set_browser_worker_closing(
  p_worker_id TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE browser_workers
  SET status = 'closing', updated_at = now()
  WHERE worker_id = p_worker_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.set_browser_worker_closing TO anon, authenticated;
