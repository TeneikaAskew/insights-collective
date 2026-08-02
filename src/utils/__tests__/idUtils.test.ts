// ABOUTME: Pins isValidUUID to the shape Postgres actually stores, not RFC 4122 versions.
// ABOUTME: The strict version/variant check turned rows that exist into "not found".

import { describe, it, expect } from 'vitest';
import { isValidUUID } from '../idUtils';

/**
 * This guard's only job is to keep a route param that is not a uuid away from a
 * uuid column, where Postgres answers 22P02 and the caller shows a database
 * error instead of its not-found state. It is not a check on how the id was
 * minted, and treating it as one cost real rows: the portfolio editor refused
 * `ffff6666-6666-6666-6666-666666666666` — a page that exists, that the list
 * screen had just rendered — because the version nibble is 6.
 */
describe('isValidUUID', () => {
  it('accepts ids Postgres accepts, whatever the version nibble says', () => {
    // v4 — the common case, and the only one the old regex allowed.
    expect(isValidUUID('9f8e7d6c-5b4a-4938-8271-6f5e4d3c2b1a')).toBe(true);
    // The seeded portfolio page id that made the editor report "not found".
    expect(isValidUUID('ffff6666-6666-6666-6666-666666666666')).toBe(true);
    // UUIDv7, which is what new id generators increasingly produce.
    expect(isValidUUID('018f3a2b-1c4d-7e8f-b012-3456789abcde')).toBe(true);
    // The nil uuid is a legal value of the type.
    expect(isValidUUID('00000000-0000-0000-0000-000000000000')).toBe(true);
    // Case is not meaningful to Postgres.
    expect(isValidUUID('FFFF6666-6666-6666-6666-666666666666')).toBe(true);
  });

  it('still rejects anything that is not uuid-shaped', () => {
    // These are the values the guard exists for — route params that would
    // otherwise reach a uuid column and come back 22P02.
    expect(isValidUUID('not-a-uuid')).toBe(false);
    expect(isValidUUID('data-analyst')).toBe(false);
    expect(isValidUUID('')).toBe(false);
    expect(isValidUUID(undefined as unknown as string)).toBe(false);
    // Right characters, wrong shape.
    expect(isValidUUID('ffff66666666666666666666666666666666')).toBe(false);
    expect(isValidUUID('ffff6666-6666-6666-6666-66666666666')).toBe(false);
    expect(isValidUUID('ffff6666-6666-6666-6666-666666666666-')).toBe(false);
    // Non-hex in a hex field.
    expect(isValidUUID('gggg6666-6666-6666-6666-666666666666')).toBe(false);
  });
});
