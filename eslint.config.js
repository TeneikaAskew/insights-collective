import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "no-useless-escape": "off",
      "@typescript-eslint/no-empty-object-type": "off",
      "prefer-const": "off",
      "no-empty": "off",
      "no-prototype-builtins": "off",
      "no-case-declarations": "off",
      "@typescript-eslint/no-require-imports": "off",
      "react-hooks/exhaustive-deps": "off",
      "react-hooks/rules-of-hooks": "warn",
    },
  },
  {
    // ── E2E: ban the assertion that cannot fail ──────────────────────────────
    //
    //   if ((await thing.count()) > 0) {
    //     await expect(thing).toBeVisible();
    //   }
    //
    // reads like a guard against flakiness. It is really a test that passes
    // both when the feature works and when it is entirely absent — the branch
    // simply does not run. The audit found 159 of these, and they are a large
    // part of why a suite of 99 specs stayed green through five column bugs
    // and six broken embeds: the pages rendered nothing, every count() was 0,
    // and every assertion was skipped.
    //
    // What to write instead, depending on what you actually mean:
    //   • the element must exist  → await expect(thing).toBeVisible()
    //   • it legitimately varies  → assert the states you accept, e.g.
    //     expect(await thing.count()).toBeGreaterThan(0) before branching, or
    //     assert on the alternative branch too so one of them must hold
    //   • it depends on seed data → seed the row (e2e/fixtures/seed.sql) and
    //     assert unconditionally
    //
    // The existing instances carry a one-time eslint-disable with a TODO.
    // Without that the rule could never land, and a rule that cannot land
    // never shrinks the backlog.
    files: ["e2e/**/*.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          // if (await x.count() > 0) / === 0 / !== 0 …
          selector:
            "IfStatement > BinaryExpression[operator=/^(>|>=|===|!==|==|!=|<|<=)$/] AwaitExpression > CallExpression > MemberExpression[property.name='count']",
          message:
            "An `if (await x.count() ...)` guard around assertions passes when the element is missing — the branch just does not run. Assert the expected state directly, or seed the data and assert unconditionally. See eslint.config.js for the alternatives.",
        },
        {
          // if (await x.count()) — the same thing written as a truthiness test.
          // Worth its own selector: the comparison form above does not match it,
          // and leaving it out would let the pattern back in through the door
          // marked "just checking whether it's there".
          selector:
            "IfStatement > AwaitExpression > CallExpression > MemberExpression[property.name='count']",
          message:
            "An `if (await x.count())` guard passes whether or not the element exists — the body just does not run. Assert the expected state directly, or seed the data and assert unconditionally. See eslint.config.js for the alternatives.",
        },
      ],
    },
  }
);
