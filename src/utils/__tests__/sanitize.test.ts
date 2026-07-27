import { describe, it, expect } from 'vitest';
import { sanitizeHTML } from '../sanitize';

describe('sanitizeHTML', () => {
  it('returns empty string for falsy input', () => {
    expect(sanitizeHTML('')).toBe('');
  });

  it('keeps basic formatting tags', () => {
    const out = sanitizeHTML('<p>Hello <strong>world</strong></p>');
    expect(out).toContain('<strong>world</strong>');
  });

  it('strips <script> tags', () => {
    const out = sanitizeHTML('<p>ok</p><script>alert(1)</script>');
    expect(out).not.toContain('<script');
    expect(out).not.toContain('alert(1)');
  });

  it('drops a javascript: href', () => {
    const out = sanitizeHTML('<a href="javascript:alert(1)">x</a>');
    expect(out).not.toContain('javascript:');
  });

  it('keeps a YouTube iframe embed', () => {
    const out = sanitizeHTML('<iframe src="https://www.youtube.com/embed/abc"></iframe>');
    expect(out).toContain('youtube.com/embed/abc');
  });

  it('removes an iframe from a non-allowlisted host', () => {
    const out = sanitizeHTML('<iframe src="https://evil.example.com/x"></iframe>');
    expect(out).not.toContain('evil.example.com');
    expect(out).not.toContain('<iframe');
  });
});
