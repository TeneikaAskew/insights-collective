// ABOUTME: The public schema's tables, views and their columns, parsed from the generated Supabase types.
// ABOUTME: Lets the unit-test Supabase mock reject a table or column the database does not have.
//
// WHY PARSE types.ts RATHER THAN SHIP ANOTHER FIXTURE
//
// The RPC guard next door reads src/test/fixtures/db-functions.json, which a
// script refreshes and CI re-checks against the live database. A second
// hand-refreshed fixture would be a second thing to forget.
//
// types.ts is already generated from the database AND already verified by CI —
// e2e.yml's Query-validity job runs "Check the committed Supabase types still
// match the database". So parsing it inherits that guarantee for free, and a
// schema change that lands without regenerating types is caught by the check
// that already exists.
//
// A regex over generated output is a blunt instrument, so `assertParsedSchema`
// below fails loudly if the parse stops finding what it expects — the same
// self-test the dead-file detector carries, for the same reason.

import { readFileSync } from 'fs';
import { join } from 'path';

export type Schema = Map<string, Set<string>>;

const TYPES_PATH = join(process.cwd(), 'src/integrations/supabase/types.ts');

/**
 * Table/view name -> its Row column names.
 *
 * Parsed from the `Tables: { … }` and `Views: { … }` blocks of the generated
 * file. Both matter: a query reads a view exactly the way it reads a table.
 */
function parseSchema(): Schema {
  const src = readFileSync(TYPES_PATH, 'utf8');
  const schema: Schema = new Map();

  // Indentation is the structure here. In the generated file a top-level
  // section (Tables, Views, Functions, Enums, CompositeTypes) sits at four
  // spaces, a relation name at six inside it, its `Row:` at eight, and each
  // column at ten.
  //
  // The section must be tracked, not just the indentation. A first version
  // matched every six-space `name: {` inside `public:`, which swept in all 61
  // entries under Functions and CompositeTypes — so `from('is_course_instructor')`
  // was accepted as a table. Worse, those arrived with EMPTY column sets, and
  // assertKnownColumn skips a relation whose columns it does not know, so each
  // bogus name also silently disabled column checking. A guard that quietly
  // stops guarding is the failure this whole suite exists to remove, so
  // assertParsedSchema now rejects any column-less relation outright.
  const lines = src.split('\n');
  let section: string | null = null;
  let current: string | null = null;
  let inRow = false;

  for (const line of lines) {
    const sectionStart = line.match(/^ {4}(\w+): \{$/);
    if (sectionStart) {
      section = sectionStart[1];
      current = null;
      inRow = false;
      continue;
    }

    // Only relations have rows to read.
    if (section !== 'Tables' && section !== 'Views') continue;

    const table = line.match(/^ {6}(\w+): \{$/);
    if (table) {
      current = table[1];
      inRow = false;
      if (!schema.has(current)) schema.set(current, new Set());
      continue;
    }
    if (!current) continue;

    if (/^ {8}Row: \{$/.test(line)) {
      inRow = true;
      continue;
    }
    if (inRow && /^ {8}\}$/.test(line)) {
      inRow = false;
      continue;
    }
    if (inRow) {
      const col = line.match(/^ {10}(\w+)(\?)?: /);
      if (col) schema.get(current)!.add(col[1]);
    }
  }

  return schema;
}

let cached: Schema | null = null;

export function getSchema(): Schema {
  if (!cached) cached = parseSchema();
  return cached;
}

/**
 * The parse's own smoke test. A regex that silently stops matching would turn
 * every guard below into a no-op that passes forever, which is the failure this
 * whole program exists to remove — so the guard checks itself before it
 * checks anything else.
 */
export function assertParsedSchema(schema: Schema = getSchema()): void {
  const problems: string[] = [];
  if (schema.size < 50) {
    problems.push(`only ${schema.size} tables parsed from types.ts; expected dozens`);
  }

  // Every relation has at least one column. An entry without any is not a
  // relation — it is something else that the parse mistook for one, and it
  // would be accepted by assertKnownTable AND skipped by assertKnownColumn.
  // This is the check that would have caught the Functions/CompositeTypes leak
  // on the first run instead of in review.
  const columnless = [...schema.entries()].filter(([, cols]) => cols.size === 0).map(([name]) => name);
  if (columnless.length) {
    problems.push(
      `${columnless.length} parsed relation(s) have no columns, so they are not relations: ` +
        `${columnless.slice(0, 8).join(', ')}${columnless.length > 8 ? ', …' : ''}`,
    );
  }

  // Names that live in OTHER sections of the generated file and must not be
  // reachable through from().
  for (const notARelation of ['is_course_instructor', 'has_admin_access', 'get_user_roles']) {
    if (schema.has(notARelation)) {
      problems.push(`"${notARelation}" is a database function, not a relation, but the parse treated it as one`);
    }
  }
  // Three tables from different parts of the schema, each with a column that
  // has been load-bearing in this codebase.
  const spot: Array<[string, string]> = [
    ['profiles', 'first_name'],
    ['quiz_submissions', 'quiz_id'],
    ['content_items', 'settings'],
  ];
  for (const [table, column] of spot) {
    if (!schema.has(table)) problems.push(`table "${table}" missing from the parse`);
    else if (!schema.get(table)!.has(column)) problems.push(`column "${table}.${column}" missing from the parse`);
  }
  if (problems.length) {
    throw new Error(`types.ts parse looks wrong — the schema guard would be vacuous:\n  ${problems.join('\n  ')}`);
  }
}
