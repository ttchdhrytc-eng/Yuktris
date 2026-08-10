type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_LABEL: Record<LogLevel, string> = {
  debug: 'DEBUG',
  info: ' INFO',
  warn: ' WARN',
  error: 'ERROR',
};

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

let minPriority = 20;

export function setLogLevel(level: LogLevel) {
  minPriority = LEVEL_PRIORITY[level];
}

function ts(): string {
  return new Date().toISOString();
}

function emit(level: LogLevel, msg: string, meta?: Record<string, unknown>) {
  if (LEVEL_PRIORITY[level] < minPriority) return;
  const metaStr = meta && Object.keys(meta).length > 0 ? ' ' + JSON.stringify(meta) : '';
  // eslint-disable-next-line no-console
  console.log(`[${ts()}] ${LEVEL_LABEL[level]} ${msg}${metaStr}`);
}

export const logger = {
  debug: (msg: string, meta?: Record<string, unknown>) => emit('debug', msg, meta),
  info: (msg: string, meta?: Record<string, unknown>) => emit('info', msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => emit('warn', msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => emit('error', msg, meta),
};
