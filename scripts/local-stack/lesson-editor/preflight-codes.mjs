// ABOUTME: The fixed preflight refusal codes and their exit statuses. run.sh maps ONLY the exit status back to a code
// ABOUTME: through a fixed case table (tests/preflight-codes-selftest.mjs checks both tables agree). Import-free.
//
// A code names the CHECK that refused, never a count, body or detail. The private detail line stays as before.

/** code -> exit status. Statuses 20..27; anything else is reported by run.sh as UNMAPPED. */
export const PREFLIGHT_EXIT = Object.freeze({
  LE_PRE_E_INPUT: 20, // usage, origin, database URL, password file, key files
  LE_PRE_E_P1: 21, // fresh synthetic stack
  LE_PRE_E_P2: 22, // T-09 queue guard
  LE_PRE_E_P3_HTTP: 23, // a P3 request failed or answered a status P3 does not accept
  LE_PRE_E_P3_COUNT: 24, // GoTrue user total or PostgREST course count differs from the database
  LE_PRE_E_P3_TABLES: 25, // a fixture table lacking, or under 90% of the public tables served
  LE_PRE_E_P4: 26, // app -> API binding
  LE_PRE_E_UNEXPECTED: 27, // uncaught error (detail withheld)
});
