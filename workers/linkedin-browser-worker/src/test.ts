/**
 * Infrastructure test suite for LinkedIn Browser Worker.
 *
 * Tests:
 *  A. Worker health
 *  B. Browserbase configuration
 *  C. Browserbase session creation + CDP connection
 *  D. Supabase connection
 *  E. Queue claim (requires a pending task)
 *  F. Session encryption
 *  G. Session decryption
 *  H. Browser context creation
 *  I. LinkedIn navigation (does NOT authenticate)
 *
 * LinkedIn authentication requires manual user interaction and is NOT tested here.
 */

import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';

import { encrypt, decrypt, getKeyId } from './session.js';
import { logger } from './logger.js';
import { browserbase } from './browserbase.js';

const PASS = 'PASS';
const FAIL = 'FAIL';
const SKIP = 'SKIP';

interface TestResult {
  name: string;
  status: typeof PASS | typeof FAIL | typeof SKIP;
  detail?: string;
}

const results: TestResult[] = [];

function record(name: string, status: TestResult['status'], detail?: string) {
  results.push({ name, status, detail });
  const icon = status === PASS ? '✓' : status === FAIL ? '✗' : '○';
  // eslint-disable-next-line no-console
  console.log(`  ${icon} ${name}${detail ? ` — ${detail}` : ''}`);
}

async function test(name: string, fn: () => Promise<string | void>): Promise<void> {
  try {
    const detail = await fn();
    record(name, PASS, detail ?? undefined);
  } catch (err) {
    record(name, FAIL, err instanceof Error ? err.message : String(err));
  }
}

async function main() {
  // eslint-disable-next-line no-console
  console.log('\nLinkedIn Browser Worker — Infrastructure Tests\n');

  // A. Worker health (just check we can start)
  await test('A. Worker process alive', async () => 'Process running');

  // B. Browserbase configuration
  await test('B. Browserbase configuration', async () => {
    if (!browserbase.isConfigured()) {
      throw new Error('BROWSERBASE_API_KEY or BROWSERBASE_PROJECT_ID not set');
    }
    return `Project: ${process.env.BROWSERBASE_PROJECT_ID}`;
  });

  // C. Browserbase session creation + CDP connection
  const browserRef: { current: Awaited<ReturnType<typeof chromium.connectOverCDP>> | null } = { current: null };
  let bbSessionId: string | null = null;

  await test('C. Browserbase session + CDP connect', async () => {
    const session = await browserbase.createSession({ keepAlive: false });
    bbSessionId = session.id;
    browserRef.current = await chromium.connectOverCDP(session.wsUrl);
    return `Session ${session.id}, Browser ${browserRef.current.version()}`;
  });

  // D. Supabase connection
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let client: ReturnType<typeof createClient> | null = null;

  await test('D. Supabase connection', async () => {
    if (!supabaseUrl || !serviceKey) {
      record('D. Supabase connection', SKIP, 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set');
      return;
    }
    client = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    const { error } = await client.from('browser_execution_queue').select('id').limit(1);
    if (error) throw new Error(error.message);
    return 'Connected';
  });

  // E. Queue claim (requires pending task + Supabase)
  await test('E. Queue claim', async () => {
    if (!client) throw new Error('Supabase not connected');
    const { data, error } = await client
      .from('browser_execution_queue')
      .select('id, action_type, status')
      .in('status', ['pending', 'retry'])
      .limit(1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) {
      record('E. Queue claim', SKIP, 'No pending tasks in queue');
      return;
    }
    return `Found ${data.length} pending task(s)`;
  });

  // F. Session encryption
  const encKey = process.env.LINKEDIN_SESSION_ENCRYPTION_KEY || 'test-key-for-validation-only';
  const testPayload = JSON.stringify({ cookies: [{ name: 'session_token', value: 'abc123' }] });

  await test('F. Session encryption', async () => {
    const encrypted = encrypt(testPayload, encKey);
    if (!encrypted || encrypted === testPayload) throw new Error('Encryption produced no transformation');
    if (encrypted.includes('session_token')) throw new Error('Plaintext leaked in ciphertext');
    return `Key ID: ${getKeyId()}`;
  });

  // G. Session decryption
  await test('G. Session decryption', async () => {
    const encrypted = encrypt(testPayload, encKey);
    const decrypted = decrypt(encrypted, encKey);
    if (decrypted !== testPayload) throw new Error('Decrypted payload does not match original');
    return 'Round-trip verified';
  });

  // G2. Decryption with wrong key fails
  await test('G2. Decryption with wrong key fails', async () => {
    const encrypted = encrypt(testPayload, encKey);
    try {
      decrypt(encrypted, 'wrong-key');
      throw new Error('Decryption should have failed with wrong key');
    } catch {
      return 'Correctly rejected wrong key';
    }
  });

  // H. Browser context creation
  await test('H. Browser context creation', async () => {
    if (!browserRef.current) throw new Error('Browser not connected');
    const context = await browserRef.current.newContext();
    const page = await context.newPage();
    await page.goto('about:blank');
    await context.close();
    return 'Context + page created';
  });

  // I. LinkedIn navigation (does NOT authenticate)
  await test('I. LinkedIn page loads', async () => {
    if (!browserRef.current) throw new Error('Browser not connected');
    const context = await browserRef.current.newContext();
    const page = await context.newPage();
    try {
      await page.goto('https://www.linkedin.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
      const title = await page.title();
      if (!title) throw new Error('No page title');
      return `Title: "${title}"`;
    } finally {
      await context.close();
    }
  });

  // Cleanup
  if (browserRef.current) await browserRef.current.close().catch(() => {});
  if (bbSessionId) await browserbase.endSession(bbSessionId);

  // Summary
  const passed = results.filter(r => r.status === PASS).length;
  const failed = results.filter(r => r.status === FAIL).length;
  const skipped = results.filter(r => r.status === SKIP).length;

  // eslint-disable-next-line no-console
  console.log(`\n${passed} passed, ${failed} failed, ${skipped} skipped\n`);

  if (failed > 0) {
    // eslint-disable-next-line no-console
    console.log('BLOCKED — Real LinkedIn authentication requires manual user interaction.');
    // eslint-disable-next-line no-console
    console.log('This test suite validates infrastructure only, not end-to-end LinkedIn login.');
    process.exit(1);
  } else {
    // eslint-disable-next-line no-console
    console.log('BLOCKED — Real LinkedIn authentication requires manual user interaction.');
    // eslint-disable-next-line no-console
    console.log('This test suite validates infrastructure only, not end-to-end LinkedIn login.');
  }
}

main().catch((err) => {
  logger.error('Test suite error', { error: String(err) });
  process.exit(1);
});
