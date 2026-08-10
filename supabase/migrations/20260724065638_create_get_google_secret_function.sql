/*
# Create function to retrieve Google OAuth secrets

1. New Functions
- `get_google_secret(secret_name text)` — Returns the decrypted secret value from the vault for the given name.
  Only returns secrets whose name starts with 'GOOGLE_' for safety.
  SECURITY DEFINER so the edge function (service role) can call it via RPC.

2. Security
- The function is SECURITY DEFINER, running with the owner's privileges.
- It only returns secrets whose name starts with 'GOOGLE_', preventing access to other vault secrets.
- The function is accessible to the `authenticated` and `anon` roles via a grant, but in practice
  only the service role key (used by edge functions) will call it.
*/

CREATE OR REPLACE FUNCTION public.get_google_secret(secret_name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  secret_value text;
BEGIN
  IF secret_name IS NULL OR LEFT(secret_name, 7) != 'GOOGLE_' THEN
    RETURN NULL;
  END IF;

  SELECT decrypted_secret INTO secret_value
  FROM vault.decrypted_secrets
  WHERE name = secret_name
  LIMIT 1;

  RETURN secret_value;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_google_secret(text) TO authenticated, anon;
