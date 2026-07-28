// ABOUTME: Tests for the plain-text input sanitizer, in both directions:
// ABOUTME: bypass payloads must be neutralised, benign text must pass untouched.

import { describe, it, expect } from 'vitest';
import { sanitizeInput, isValidUrl, isValidRedirectUrl } from '../securityUtils';

describe('sanitizeInput', () => {
  /**
   * The bypass class CodeQL reported (js/incomplete-multi-character-
   * sanitization): a single-pass replace turns `javasjavascript:cript:` into
   * `javascript:` — removal reassembles the payload. The fixpoint loop must
   * leave nothing reassemblable.
   */
  describe('neutralises reassembly payloads', () => {
    const payloads = [
      'javasjavascript:cript:alert(1)',
      'javajavascript:script:alert(1)',
      '<scr<script>ipt>alert(1)</scr</script>ipt>',
      'vbvbscript:script:x',
      'datadata:: text',
    ];

    it.each(payloads)('%j contains no executable scheme or tag after sanitising', (payload) => {
      const out = sanitizeInput(payload).toLowerCase();
      expect(out).not.toMatch(/javascript\s*:/);
      expect(out).not.toMatch(/vbscript\s*:/);
      expect(out).not.toMatch(/data\s*:/);
      expect(out).not.toMatch(/<script/);
    });
  });

  /**
   * The old version enumerated four tag names, so an <img onerror=…> — not on
   * the list, handler unquoted — passed through both filters entirely. Plain
   * text has no legitimate markup; anything tag-shaped goes.
   */
  describe('strips all tag-shaped content, not four named tags', () => {
    it.each([
      ['<img src=x onerror=alert(1)>'],
      ['<svg onload=alert(1)>'],
      ['<a href="javascript:alert(1)">x</a>'],
      ['<SCRIPT>alert(1)</SCRIPT>'],
      ['unclosed at end <script'],
      ['</script >late closer'],
    ])('removes the tag from %j', (payload) => {
      const out = sanitizeInput(payload).toLowerCase();
      expect(out).not.toContain('<img');
      expect(out).not.toContain('<svg');
      expect(out).not.toContain('<a ');
      expect(out).not.toContain('<script');
      expect(out).not.toContain('onerror');
      expect(out).not.toContain('onload');
    });
  });

  /**
   * The other direction. formValidation.ts rejects any input this function
   * modifies, so over-stripping turns into user-facing "invalid characters"
   * errors on innocent text. `<` not followed by a tag-start character is not
   * a tag to any browser and must survive.
   */
  describe('leaves benign plain text untouched', () => {
    it.each([
      ['hello world'],
      ['a < b and c > d'],
      ['I <3 TypeScript'],
      ['5<6'],
      ['price is $3, url is https://example.com/page'],
      ['multi\nline\ntext'],
    ])('returns %j unchanged', (text) => {
      expect(sanitizeInput(text)).toBe(text);
    });
  });

  it('fails closed on input that will not converge within the pass budget', () => {
    // Each layer of nesting needs one pass to unwrap; 12 layers exceeds the
    // budget of 10, and half-cleaned output must not escape.
    let payload = 'javascript:';
    for (let i = 0; i < 12; i++) payload = `javas${payload}cript:`;
    expect(sanitizeInput(payload)).toBe('');
  });

  it('returns empty string for falsy input', () => {
    expect(sanitizeInput('')).toBe('');
  });
});

describe('isValidUrl', () => {
  it('accepts http(s) and rejects other schemes', () => {
    expect(isValidUrl('https://example.com')).toBe(true);
    expect(isValidUrl('http://example.com')).toBe(true);
    expect(isValidUrl('javascript:alert(1)')).toBe(false);
    expect(isValidUrl('not a url')).toBe(false);
  });
});

describe('isValidRedirectUrl', () => {
  it('matches exact domain and subdomains, not lookalikes', () => {
    const allowed = ['example.com'];
    expect(isValidRedirectUrl('https://example.com/x', allowed)).toBe(true);
    expect(isValidRedirectUrl('https://app.example.com/x', allowed)).toBe(true);
    expect(isValidRedirectUrl('https://evil-example.com/x', allowed)).toBe(false);
    expect(isValidRedirectUrl('https://example.com.evil.net/x', allowed)).toBe(false);
  });
});
