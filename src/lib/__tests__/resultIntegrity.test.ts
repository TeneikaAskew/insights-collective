// ABOUTME: Covers the shared "never store an empty result" guard — what counts
// ABOUTME: as empty, that the refusal is a distinguishable error type, and that
// ABOUTME: the toast it produces says nothing was saved rather than "try again".
import { describe, expect, it } from 'vitest';
import {
  EmptyResultError,
  assertStorableResult,
  emptyResultToast,
  isEmptyResult,
  isEmptyResultError,
} from '../resultIntegrity';

describe('isEmptyResult', () => {
  it('treats absent values as empty', () => {
    expect(isEmptyResult(null)).toBe(true);
    expect(isEmptyResult(undefined)).toBe(true);
  });

  it('treats blank text as empty', () => {
    expect(isEmptyResult('')).toBe(true);
    expect(isEmptyResult('   \n ')).toBe(true);
    expect(isEmptyResult('hello')).toBe(false);
  });

  it('treats an all-zero score object as empty', () => {
    // The shape that caused this: a well-formed, present, entirely zero score
    // set, stored as though it were a result.
    expect(
      isEmptyResult({
        'AI/ML': 0,
        Analytics: 0,
        'Data Engineering': 0,
        'Business Intelligence': 0,
      }),
    ).toBe(true);
  });

  it('treats a single non-zero score as a result', () => {
    expect(
      isEmptyResult({
        'AI/ML': 0,
        Analytics: 0,
        'Data Engineering': 4,
        'Business Intelligence': 0,
      }),
    ).toBe(false);
  });

  it('treats empty containers as empty', () => {
    expect(isEmptyResult({})).toBe(true);
    expect(isEmptyResult([])).toBe(true);
    expect(isEmptyResult([null, '', {}])).toBe(true);
    expect(isEmptyResult([0, 'x'])).toBe(false);
  });

  it('does not call `false` empty', () => {
    // A boolean answer of `false` is an answer. Sweeping it in with the blanks
    // would refuse to store a legitimate result.
    expect(isEmptyResult(false)).toBe(false);
    expect(isEmptyResult({ optedIn: false })).toBe(false);
  });

  it('treats NaN and Infinity as empty', () => {
    expect(isEmptyResult(Number.NaN)).toBe(true);
    expect(isEmptyResult(Number.POSITIVE_INFINITY)).toBe(true);
  });
});

describe('assertStorableResult', () => {
  it('returns the value when there is a result', () => {
    const scores = { 'AI/ML': 3 };
    expect(assertStorableResult('quiz attempt', scores)).toBe(scores);
  });

  it('throws a distinguishable error when there is not', () => {
    let thrown: unknown;
    try {
      assertStorableResult('quiz attempt', {}, 'no questions were answered');
    } catch (error) {
      thrown = error;
    }

    expect(isEmptyResultError(thrown)).toBe(true);
    expect((thrown as EmptyResultError).subject).toBe('quiz attempt');
    expect((thrown as Error).message).toMatch(/no questions were answered/);
  });

  it('is distinguishable from an ordinary failure', () => {
    // The point of the separate type: a save that failed on the network and a
    // save that was refused for emptiness need different words, and a caller
    // catching both has to be able to tell them apart.
    expect(isEmptyResultError(new Error('network down'))).toBe(false);
  });
});

describe('emptyResultToast', () => {
  it('says nothing was saved, and does not invite a retry', () => {
    const toast = emptyResultToast(new EmptyResultError('quiz attempt'));
    expect(toast.variant).toBe('destructive');
    expect(toast.description).toMatch(/quiz attempt/);
    expect(toast.description).toMatch(/not saved/i);
  });
});
