// ABOUTME: One rule for every "save the user's result" path — refuse to write a
// ABOUTME: row that carries no result, and fail loudly enough that the caller can
// ABOUTME: tell the person instead of leaving them with an empty record.

/**
 * Thrown when a write is refused because there was nothing to write.
 *
 * A distinct type, not a bare Error, because the two failures need different
 * words: a network or permission failure means "we could not save it, try
 * again", while this means "there was nothing to save". Call sites that catch
 * both used to print the first message for both, which sends someone off to
 * retry a save that will keep refusing for the same reason.
 */
export class EmptyResultError extends Error {
  /** Human-readable name of the thing that was empty, e.g. 'quiz attempt'. */
  readonly subject: string;

  constructor(subject: string, detail?: string) {
    super(
      detail
        ? `Refusing to store an empty ${subject}: ${detail}`
        : `Refusing to store an empty ${subject}.`,
    );
    this.name = 'EmptyResultError';
    this.subject = subject;
  }
}

export const isEmptyResultError = (error: unknown): error is EmptyResultError =>
  error instanceof EmptyResultError;

/**
 * Is this payload devoid of any result?
 *
 * Deliberately broad, because "empty" arrived in several shapes in practice:
 * an all-zero score object, a `{}` of quiz answers, a blank assistant message,
 * an undefined report. Numbers count as content only when non-zero — the case
 * this exists for is a score set that is present, well-formed, and all zeros.
 */
export const isEmptyResult = (value: unknown): boolean => {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (typeof value === 'number') return !Number.isFinite(value) || value === 0;
  if (typeof value === 'boolean') return false;
  if (Array.isArray(value)) return value.length === 0 || value.every(isEmptyResult);
  if (typeof value === 'object') {
    const values = Object.values(value as Record<string, unknown>);
    return values.length === 0 || values.every(isEmptyResult);
  }
  return false;
};

/**
 * Return `value`, or throw if there is no result in it.
 *
 * Use at the point of the write, not at the point of the click: the write is
 * the last place that sees the real payload, and guarding there covers every
 * caller including the ones added later.
 */
export function assertStorableResult<T>(subject: string, value: T, detail?: string): T {
  if (isEmptyResult(value)) {
    throw new EmptyResultError(subject, detail);
  }
  return value;
}

/**
 * The message to show someone when a save was refused for emptiness.
 *
 * Says what did not happen and why, and does not invite a retry — retrying is
 * exactly what will not help.
 */
export const emptyResultToast = (error: EmptyResultError) => ({
  title: 'Nothing to save',
  description: `Your ${error.subject} came through empty, so it was not saved. Please complete it and try again.`,
  variant: 'destructive' as const,
});
