export const DEFAULT_INTERACTIVE_AUTH_TIMEOUT_MS = 30 * 60 * 1000;
export const DEFAULT_INTERACTIVE_BROWSER_SESSION_TIMEOUT_MS = 35 * 60 * 1000;

function positiveMilliseconds(value: string | undefined, fallback: number, name: string): number {
  const parsed = value === undefined ? fallback : Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${name} must be a positive millisecond value`);
  return parsed;
}

export function interactiveAuthTimeoutMs(env: NodeJS.ProcessEnv = process.env): number {
  return positiveMilliseconds(env.INTERACTIVE_AUTH_TIMEOUT_MS ?? env.CONNECTION_TIMEOUT_MS,
    DEFAULT_INTERACTIVE_AUTH_TIMEOUT_MS, 'INTERACTIVE_AUTH_TIMEOUT_MS');
}

export function interactiveBrowserSessionTimeoutMs(env: NodeJS.ProcessEnv = process.env): number {
  const timeout = positiveMilliseconds(env.BROWSERBASE_INTERACTIVE_SESSION_TIMEOUT_MS,
    DEFAULT_INTERACTIVE_BROWSER_SESSION_TIMEOUT_MS, 'BROWSERBASE_INTERACTIVE_SESSION_TIMEOUT_MS');
  if (timeout <= interactiveAuthTimeoutMs(env)) {
    throw new Error('Browserbase interactive session timeout must exceed the human authentication timeout');
  }
  return timeout;
}
