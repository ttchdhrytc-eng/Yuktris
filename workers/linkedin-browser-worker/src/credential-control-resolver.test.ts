import test from 'node:test';
import assert from 'node:assert/strict';
import type { Locator, Page } from 'playwright';
import { resolveFirstInteractiveLocator } from './linkedin.js';

type Candidate = { id: string; visible: boolean; enabled?: boolean; editable?: boolean };

function fakePage(matches: Record<string, Candidate[]>): Pick<Page, 'locator'> {
  return {
    locator(selector: string) {
      return {
        async all() {
          return (matches[selector] ?? []).map(candidate => ({
            async isVisible() { return candidate.visible; },
            async isEnabled() { return candidate.enabled !== false; },
            async isEditable() { return candidate.editable !== false; },
            async getAttribute(name: string) { return name === 'data-test-id' ? candidate.id : null; },
          } as unknown as Locator));
        },
      } as unknown as Locator;
    },
  } as Pick<Page, 'locator'>;
}

async function selectedId(locator: Locator | null): Promise<string | null> {
  return locator?.getAttribute('data-test-id') ?? null;
}

test('hidden session_key before visible username selects visible username', async () => {
  const page = fakePage({
    '#username': [{ id: 'visible-username', visible: true }],
    'input[name="session_key"]': [{ id: 'hidden-session-key', visible: false }],
  });
  const result = await resolveFirstInteractiveLocator(page, ['input[name="session_key"]', '#username'], { editable: true, timeoutMs: 1 });
  assert.equal(await selectedId(result), 'visible-username');
});

test('hidden first password match selects the visible password', async () => {
  const page = fakePage({ 'input[type="password"]': [
    { id: 'hidden-password', visible: false }, { id: 'visible-password', visible: true },
  ] });
  const result = await resolveFirstInteractiveLocator(page, ['input[type="password"]'], { editable: true, timeoutMs: 1 });
  assert.equal(await selectedId(result), 'visible-password');
});

test('hidden submit before visible submit selects visible enabled submit', async () => {
  const page = fakePage({ 'button[type="submit"]': [
    { id: 'hidden-submit', visible: false }, { id: 'visible-submit', visible: true, enabled: true },
  ] });
  const result = await resolveFirstInteractiveLocator(page, ['button[type="submit"]'], { timeoutMs: 1 });
  assert.equal(await selectedId(result), 'visible-submit');
});
