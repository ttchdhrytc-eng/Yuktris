export const DEFAULT_CLOUD_AGENT_STARTUP_TIMEOUT_MS = 90_000;

export class CloudAgentStartupError extends Error {
  constructor(public readonly stage: string) {
    super('Cloud LinkedIn Agent startup timed out');
    this.name = 'CloudAgentStartupError';
  }
}

export function cloudAgentStartupTimeoutMs(env: NodeJS.ProcessEnv = process.env): number {
  const value = Number(env.CLOUD_AGENT_STARTUP_TIMEOUT_MS ?? DEFAULT_CLOUD_AGENT_STARTUP_TIMEOUT_MS);
  if (!Number.isFinite(value) || value < 30_000 || value > 120_000) throw new Error('CLOUD_AGENT_STARTUP_TIMEOUT_MS must be between 30000 and 120000');
  return value;
}

export async function withinStartupDeadline<T>(operation: Promise<T>, startedAt: number, stage: string, timeoutMs = cloudAgentStartupTimeoutMs()): Promise<T> {
  const remaining = timeoutMs - (Date.now() - startedAt);
  if (remaining <= 0) throw new CloudAgentStartupError(stage);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([operation, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new CloudAgentStartupError(stage)), remaining);
    })]);
  } finally { if (timer) clearTimeout(timer); }
}
