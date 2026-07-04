import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LIFECYCLE_STATES,
  TRANSITIONS,
  canTransition,
  assertTransition,
  LifecycleTransitionError,
  recommendationToState,
  type LifecycleState,
} from './lifecycle';

// Run with:  node --test --experimental-strip-types src/lib/lifecycle.test.ts
// (or via a ts-aware runner). Pure logic — no DB, no network.

test('every transition target is a known lifecycle state', () => {
  for (const [from, targets] of Object.entries(TRANSITIONS)) {
    assert.ok(LIFECYCLE_STATES.includes(from as LifecycleState), `${from} is a state`);
    for (const to of targets) {
      assert.ok(LIFECYCLE_STATES.includes(to), `${from} → ${to} targets a known state`);
    }
  }
});

test('canTransition accepts exactly the matrix entries', () => {
  for (const from of LIFECYCLE_STATES) {
    for (const to of LIFECYCLE_STATES) {
      const expected = TRANSITIONS[from].includes(to);
      assert.equal(canTransition(from, to), expected, `${from} → ${to}`);
    }
  }
});

test('archived is terminal', () => {
  assert.deepEqual(TRANSITIONS.archived, []);
  for (const to of LIFECYCLE_STATES) {
    assert.equal(canTransition('archived', to), false);
  }
});

test('assertTransition throws on illegal transitions only', () => {
  assert.doesNotThrow(() => assertTransition('draft', 'submitted'));
  assert.throws(() => assertTransition('draft', 'approved'), LifecycleTransitionError);
});

test('LifecycleTransitionError carries bilingual messages and locale switch', () => {
  const err = new LifecycleTransitionError('submitted', 'implemented');
  assert.match(err.messages.en, /Illegal lifecycle transition/);
  assert.match(err.messages.ar, /انتقال غير مسموح/);
  try {
    assertTransition('submitted', 'implemented', 'ar');
    assert.fail('should have thrown');
  } catch (e) {
    assert.ok(e instanceof LifecycleTransitionError);
    assert.equal(e.message, e.messages.ar);
  }
});

test('recommendationToState maps every recommendation', () => {
  assert.equal(recommendationToState('approve'), 'approved');
  assert.equal(recommendationToState('revise'), 'feedback_requested');
  assert.equal(recommendationToState('reject'), 'rejected');
  assert.equal(recommendationToState('escalate'), 'under_review');
});
