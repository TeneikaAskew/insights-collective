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

  // Indentation is the structure here. In the generated file a table name sits
  // at six spaces inside `public:`, its `Row:` at eight, and each column at ten.
  const lines = src.split('\n');
  let current: string | null = null;
  let inRow = false;

  for (const line of lines) {
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

  // Blocks that are not tables but match the same indentation.
  for (const notATable of ['Row', 'Insert', 'Update', 'Relationships', 'Args', 'Returns']) {
    schema.delete(notATable);
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
 * whole programme exists to remove — so the guard checks itself before it
 * checks anything else.
 */
export function assertParsedSchema(schema: Schema = getSchema()): void {
  const problems: string[] = [];
  if (schema.size < 50) {
    problems.push(`only ${schema.size} tables parsed from types.ts; expected dozens`);
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
