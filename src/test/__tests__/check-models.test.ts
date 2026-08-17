// ABOUTME: Tests for the model-id guard in scripts/check-models.mjs.
// ABOUTME: Each case is a failure this repo actually shipped, or a false positive that would make the check ignorable.
//
// The guard exists because a model id is just a string: nothing in the type
// system or the test suite knows whether a provider still serves it. But the
// guard is itself a regex, and a regex can be quietly wrong — the first draft
// matched `\b(?:model|MODEL)\s*[:=]` and missed `CHAT_MODEL`, because the
// character before MODEL is an underscore and `\b` needs a non-word character
// there. CHAT_MODEL is precisely the constant that sent a Together AI id to the
// Lovable gateway and broke resume chat, so the check would have missed the bug
// it was written for while reporting a clean run.
//
// That is the reason these tests exist rather than trusting `npm run
// check:models` to come back green against whatever the repo contains today.

import { describe, expect, it } from 'vitest';

import { ALLOWED, DECOMMISSIONED, findModelProblems } from '../../../scripts/check-models.mjs';

type Problem = { line: number; id: string; decommissioned: boolean; why: string };
const scan = (source: string): Problem[] => findModelProblems(source);

describe('check-models guard', () => {
  describe('catches what actually broke', () => {
    it('flags a decommissioned id and says when it was shut down', () => {
      const problems = scan('const MODEL = "llama3-8b-8192";');

      expect(problems).toHaveLength(1);
      expect(problems[0].id).toBe('llama3-8b-8192');
      expect(problems[0].decommissioned).toBe(true);
      expect(problems[0].why).toContain('2025-08-30');
    });

    it('flags the 70b that was decommissioned mid-migration', () => {
      const problems = scan('const MODEL = "llama-3.3-70b-versatile";');

      expect(problems).toHaveLength(1);
      expect(problems[0].decommissioned).toBe(true);
    });

    // The regression the first draft of the guard let through.
    it('flags a foreign provider id assigned to CHAT_MODEL, despite the underscore', () => {
      const problems = scan("const CHAT_MODEL = 'meta-llama/Llama-3-8b-chat-hf';");

      expect(problems).toHaveLength(1);
      expect(problems[0].id).toBe('meta-llama/Llama-3-8b-chat-hf');
      expect(problems[0].decommissioned).toBe(false);
      expect(problems[0].why).toContain('allowlist');
    });

    it('flags an unrecognised id however the variable is spelled', () => {
      for (const line of [
        "const selectedModel = 'gpt-4';",
        'let modelName = "claude-3-opus";',
        '  model: "some/new-model",',
        'const AI_MODEL_ID = `mistral-large`;',
      ]) {
        expect(scan(line), line).toHaveLength(1);
      }
    });

    it('flags compound-beta-mini, which resolves but rejects tool calling', () => {
      const problems = scan("model: 'compound-beta-mini',");

      expect(problems).toHaveLength(1);
      expect(problems[0].decommissioned).toBe(true);
      expect(problems[0].why).toContain('tool calling');
    });
  });

  describe('stays quiet on what is correct', () => {
    it('accepts every allowlisted id in any assignment shape', () => {
      for (const id of ALLOWED.keys()) {
        expect(scan(`const MODEL = "${id}";`), id).toEqual([]);
        expect(scan(`  model: '${id}',`), id).toEqual([]);
        expect(scan(`const CHAT_MODEL = '${id}';`), id).toEqual([]);
      }
    });

    it('ignores a dead id named in a comment', () => {
      const source = [
        '// Replaces llama3-8b-8192, decommissioned 2025-08-30.',
        '  // was model: "compound-beta-mini"',
        'const MODEL = "openai/gpt-oss-120b";',
      ].join('\n');

      expect(scan(source)).toEqual([]);
    });

    it('ignores ids built by interpolation, which are resolved elsewhere', () => {
      expect(scan('const MODEL = `${provider}/${name}`;')).toEqual([]);
    });

    it('ignores an empty string', () => {
      expect(scan("const MODEL = '';")).toEqual([]);
    });
  });

  describe('the two lists stay coherent', () => {
    it('never allows an id it also calls decommissioned', () => {
      const contradictory = [...ALLOWED.keys()].filter((id) => DECOMMISSIONED.has(id));

      expect(contradictory).toEqual([]);
    });

    it('records where every allowed id is served, so the provider is checkable', () => {
      for (const [id, where] of ALLOWED) {
        expect(where, id).toMatch(/\S/);
      }
    });
  });

  it('reports the line each problem is on', () => {
    const source = ['const a = 1;', 'const b = 2;', 'const MODEL = "llama3-8b-8192";'].join('\n');

    expect(scan(source)[0].line).toBe(3);
  });
});
