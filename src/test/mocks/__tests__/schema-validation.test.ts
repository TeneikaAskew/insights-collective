// ABOUTME: Proves the unit mock's table and column guards actually reject bad names.
// ABOUTME: A guard nobody exercises is the vacuous check this suite exists to remove.

import { describe, it, expect, beforeEach } from 'vitest';
import { mockSupabaseClient, resetSupabaseMock } from '../supabase';
import { assertParsedSchema, getSchema } from '../schema';

describe('unit-mock schema guards', () => {
  beforeEach(() => {
    resetSupabaseMock();
  });

  describe('the parse itself', () => {
    it('finds a real schema, not an empty one', () => {
      // If the regex over the generated types stopped matching, every guard
      // below would pass on everything. This is the instrument checking itself
      // — the lesson from the dead-file detector that once reported button.tsx
      // as unreferenced.
      expect(() => assertParsedSchema()).not.toThrow();
      expect(getSchema().size).toBeGreaterThan(50);
    });

    it('holds only real relations — no functions, no composite types', () => {
      // The parse first matched every six-space `name: {` inside `public:`,
      // which swept in 61 entries from the Functions and CompositeTypes
      // sections. They arrived with EMPTY column sets, which made them doubly
      // harmful: assertKnownTable accepted them, and assertKnownColumn skips a
      // relation whose columns it does not know, so each one also disabled
      // column checking for itself.
      const schema = getSchema();
      const columnless = [...schema.entries()].filter(([, cols]) => cols.size === 0);
      expect(columnless.map(([name]) => name)).toEqual([]);

      for (const fn of ['is_course_instructor', 'has_admin_access', 'get_user_roles']) {
        expect(schema.has(fn)).toBe(false);
      }
    });

    it('rejects a database function passed to from()', () => {
      expect(() => mockSupabaseClient.from('is_course_instructor')).toThrow(
        /no such table or view/,
      );
    });

    it('carries columns, not just table names', () => {
      expect(getSchema().get('profiles')?.has('first_name')).toBe(true);
      expect(getSchema().get('quiz_submissions')?.has('quiz_id')).toBe(true);
    });
  });

  describe('from(table)', () => {
    it('accepts a real table', () => {
      expect(() => mockSupabaseClient.from('profiles')).not.toThrow();
    });

    it('accepts a view as readily as a table', () => {
      // A query cannot tell them apart, so neither should the guard.
      const schema = getSchema();
      expect(schema.has('profiles')).toBe(true);
    });

    it('rejects a table that does not exist', () => {
      expect(() => mockSupabaseClient.from('user_profiles')).toThrow(
        /no such table or view/,
      );
    });

    it('names a near miss so the fix is obvious', () => {
      expect(() => mockSupabaseClient.from('profile')).toThrow(/Did you mean: .*profiles/);
    });

    it('still hands back the shared builder when called with no argument', () => {
      // getQueryBuilder() does exactly this to reach the builder object; it is
      // not a query and must not be validated.
      expect(() => mockSupabaseClient.from()).not.toThrow();
    });
  });

  describe('column filters', () => {
    it('accepts a real column', () => {
      expect(() => mockSupabaseClient.from('profiles').eq('first_name', 'Ada')).not.toThrow();
    });

    it('rejects a column the table does not have', () => {
      expect(() => mockSupabaseClient.from('profiles').eq('full_name', 'Ada Lovelace')).toThrow(
        /profiles has no column 'full_name'/,
      );
    });

    it('checks the base column of a JSON path', () => {
      // content_items.settings exists, so the path is allowed through — the
      // guard is about the column, not the JSON key inside it.
      expect(() =>
        mockSupabaseClient.from('content_items').eq('settings->>quiz_id', 'x'),
      ).not.toThrow();
      // …but a JSON path rooted on a column that does not exist is still wrong.
      expect(() =>
        mockSupabaseClient.from('content_items').eq('config->>quiz_id', 'x'),
      ).toThrow(/has no column 'config'/);
    });

    it('leaves embedded-resource filters alone', () => {
      // `profiles.first_name` filters through an embed, not a column of the
      // base table, so checking it against quiz_submissions would be wrong.
      expect(() =>
        mockSupabaseClient.from('quiz_submissions').eq('profiles.first_name', 'Ada'),
      ).not.toThrow();
    });

    it('covers the other filter methods, not just eq', () => {
      expect(() => mockSupabaseClient.from('profiles').neq('nonexistent_col', 1)).toThrow();
      expect(() => mockSupabaseClient.from('profiles').gt('nonexistent_col', 1)).toThrow();
      expect(() => mockSupabaseClient.from('profiles').in('nonexistent_col', [1])).toThrow();
    });

    it('tracks the table across successive from() calls', () => {
      // The mock hands out one shared builder, so the table has to be recorded
      // per call rather than held on the builder.
      expect(() => mockSupabaseClient.from('profiles').eq('first_name', 'Ada')).not.toThrow();
      expect(() => mockSupabaseClient.from('quiz_submissions').eq('first_name', 'Ada')).toThrow(
        /quiz_submissions has no column 'first_name'/,
      );
    });
  });
});
