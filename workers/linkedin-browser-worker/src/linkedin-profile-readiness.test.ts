import assert from 'node:assert/strict';
import { test } from 'node:test';
import { profileReadinessSatisfied } from './linkedin-profile-readiness.js';

const stable = { targetMatched: true, mainFound: true, headerFound: true, actionRowFound: true, skeletonDetected: false };

test('requires two stable meaningful observations', () => {
  assert.equal(profileReadinessSatisfied(stable, 1), false);
  assert.equal(profileReadinessSatisfied(stable, 2), true);
});
test('delayed SPA header prevents premature readiness', () => assert.equal(profileReadinessSatisfied({ ...stable, headerFound: false }, 3), false));
test('missing action row before hydration prevents readiness', () => assert.equal(profileReadinessSatisfied({ ...stable, actionRowFound: false }, 3), false));
test('loading skeleton prevents readiness despite controls', () => assert.equal(profileReadinessSatisfied({ ...stable, skeletonDetected: true }, 3), false));
test('canonical target mismatch prevents readiness', () => assert.equal(profileReadinessSatisfied({ ...stable, targetMatched: false }, 3), false));
