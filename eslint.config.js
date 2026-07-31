import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", ".claude", "coverage"] },
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
  },
  {
    // ── Design system: no raw Tailwind palette classes ───────────────────────
    //
    // Soft Studio tokens (bg-background, text-muted-foreground, bg-accent,
    // ss-* colors) are the only sanctioned colors. Raw palette classes
    // (bg-gray-100, text-blue-500, bg-white) bypass theming and break in
    // Ink Studio dark. The sweep converted the whole backlog, so this is an
    // error — new raw palette classes cannot land. The one exemption is the
    // portfolio template block below.
    files: ["src/**/*.tsx"],
    ignores: ["src/**/__tests__/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "Literal[value=/(^|[ '\"`])(bg|text|border|from|via|to|ring|fill|stroke|divide|outline|decoration|accent|caret|shadow)-(gray|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]/]",
          message:
            "Raw Tailwind palette class — use Soft Studio tokens instead (bg-background, bg-card, text-muted-foreground, border-border, bg-accent, ss-* colors). See src/index.css.",
        },
        {
          selector:
            "TemplateElement[value.raw=/(^|[ '\"`])(bg|text|border|from|via|to|ring|fill|stroke)-(gray|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]/]",
          message:
            "Raw Tailwind palette class in template string — use Soft Studio tokens instead. See src/index.css.",
        },
        {
          selector: "Literal[value=/(^|[ '\"`])(bg-white|bg-black)([ '\"`]|$)/]",
          message:
            "bg-white/bg-black bypass theming — use bg-card / bg-background (or an overlay token) instead.",
        },
      ],
    },
  },
  {
    // ── Exemption: portfolio owner-facing templates ──────────────────────────
    //
    // These files render the portfolio OWNER's chosen theme on the public
    // portfolio page: fixed-light template surfaces, per-theme color maps, and
    // the theme-picker swatches that depict real stored colors. Tokenizing
    // them would flip the owner's design with the app theme. App chrome in
    // the portfolio editor is NOT exempt and stays converted.
    files: [
      "src/components/portfolio/layouts/**",
      "src/components/portfolio/EnhancedProjectCard.tsx",
      "src/components/portfolio/EnhancedPortfolioEditor.tsx",
    ],
    rules: {
      "no-restricted-syntax": "off",
    },
  }
);
