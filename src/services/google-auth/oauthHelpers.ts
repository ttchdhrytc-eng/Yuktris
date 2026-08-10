// ============================================================
// Shared OAuth Helpers — single source of truth for PKCE + URL building
// ============================================================
//
// Used by GoogleOAuthService and GoogleWorkspaceService to eliminate
// duplicated generateRandomString / generateCodeChallenge / OAuth URL
// construction logic.

const GOOGLE_AUTH_BASE = 'https://accounts.google.com/o/oauth2/v2/auth';

const PKCE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';

export function generateRandomString(length: number): string {
  const values = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(values).map((v) => PKCE_CHARS[v % PKCE_CHARS.length]).join('');
}

export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export type OAuthStateData = {
  state: string;
  codeVerifier: string;
  workspaceId: string;
  userId: string;
  scopes: string;
  createdAt: number;
};

export function buildOAuthUrl(params: {
  clientId: string;
  redirectUri: string;
  scopes: string[];
  state: string;
  codeChallenge: string;
}): string {
  const urlParams = new URLSearchParams({
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    response_type: 'code',
    scope: params.scopes.join(' '),
    state: params.state,
    code_challenge: params.codeChallenge,
    code_challenge_method: 'S256',
    access_type: 'offline',
    prompt: 'consent',
  });

  if (import.meta.env.DEV) {
    console.info('[OAuth] buildOAuthUrl', {
      provider: 'google',
      clientId: params.clientId ? `${params.clientId.slice(0, 12)}...` : '(MISSING)',
      redirectUri: params.redirectUri,
      scopes: params.scopes,
      origin: window.location.origin,
      env: import.meta.env.MODE,
    });
  }

  return `${GOOGLE_AUTH_BASE}?${urlParams.toString()}`;
}

export function getRedirectUri(override?: string): string {
  // Always derive the redirect URI from the current origin so it matches
  // whatever domain the app is actually running on. A hardcoded env value
  // causes redirect_uri_mismatch when the app runs on a different domain.
  const dynamic = `${window.location.origin}/api/google/callback`;

  if (import.meta.env.DEV) {
    const envVal = import.meta.env.VITE_GOOGLE_REDIRECT_URI;
    console.info('[OAuth] redirect_uri =', dynamic, envVal ? `(env override available but unused: ${envVal})` : '(no env override)');
  }

  return override ?? dynamic;
}

export function getClientId(): string {
  const id = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';
  if (import.meta.env.DEV) {
    console.info('[OAuth] client_id =', id ? `${id.slice(0, 12)}...` : '(MISSING)');
  }
  return id;
}
