// ABOUTME: Unit tests for the assessed-content completion rule: assignments and quizzes complete
// ABOUTME: only via submission; informational content can complete from viewing.
import { describe, it, expect } from 'vitest';
import { canMarkComplete, isAssessedContentType } from '../progressionStates';

describe('assessed completion rule', () => {
  it('treats assignments and quizzes as assessed', () => {
    expect(isAssessedContentType('assignment')).toBe(true);
    expect(isAssessedContentType('quiz')).toBe(true);
    expect(isAssessedContentType('page')).toBe(false);
  });
  it('viewing cannot complete an assignment or quiz', () => {
    expect(canMarkComplete('assignment', 'view')).toBe(false);
    expect(canMarkComplete('quiz', 'view')).toBe(false);
  });
  it('submission completes an assignment or quiz', () => {
    expect(canMarkComplete('assignment', 'submission')).toBe(true);
    expect(canMarkComplete('quiz', 'submission')).toBe(true);
  });
  it('viewing completes a page', () => {
    expect(canMarkComplete('page', 'view')).toBe(true);
  });
});
