import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyLinkedInDisplayName, verifyProductionAcceptanceIdentity } from './linkedin-profile-identity.js';

test('exact expected display name passes', () => {
  assert.equal(verifyLinkedInDisplayName('Paul Hernandez', 'Paul Hernandez').allowed, true);
});

test('harmless whitespace and Unicode presentation differences pass', () => {
  assert.equal(verifyLinkedInDisplayName('  Paul   Hernandez ', 'Paul\u00a0Hernandez').allowed, true);
  assert.equal(verifyLinkedInDisplayName('Paul Hernandez', 'Ｐａｕｌ Hernandez').allowed, true);
});

test('wrong or partial identity fails closed', () => {
  const wrong = verifyLinkedInDisplayName('Paul Hernandez', 'Pablo Hernandez');
  const partial = verifyLinkedInDisplayName('Paul Hernandez', 'Paul');
  assert.equal(wrong.allowed, false);
  assert.equal(partial.allowed, false);
  if (!wrong.allowed) assert.equal(wrong.code, 'displayed_name_mismatch');
  if (!partial.allowed) assert.equal(partial.code, 'displayed_name_mismatch');
});

test('missing expected or displayed identity fails closed', () => {
  assert.equal(verifyLinkedInDisplayName('', 'Paul Hernandez').allowed, false);
  assert.equal(verifyLinkedInDisplayName('Paul Hernandez', '').allowed, false);
  assert.equal(verifyLinkedInDisplayName('Paul Hernandez', undefined).allowed, false);
});

test('inaccessible or unhydrated displayed identity fails closed', () => {
  assert.equal(verifyLinkedInDisplayName('Paul Hernandez', null).allowed, false);
});

test('correct name with wrong canonical URL fails closed', () => {
  const result = verifyProductionAcceptanceIdentity(
    'https://www.linkedin.com/in/mrpaul-hernandez',
    'https://www.linkedin.com/in/someone-else',
    'Paul Hernandez',
    'Paul Hernandez',
  );
  assert.equal(result.allowed, false);
  if (!result.allowed) assert.equal(result.code, 'canonical_target_mismatch');
});

test('correct canonical URL with wrong name fails closed', () => {
  const target = 'https://www.linkedin.com/in/mrpaul-hernandez';
  const result = verifyProductionAcceptanceIdentity(target, target, 'Paul Hernandez', 'Someone Else');
  assert.equal(result.allowed, false);
  if (!result.allowed) assert.equal(result.code, 'displayed_name_mismatch');
});
