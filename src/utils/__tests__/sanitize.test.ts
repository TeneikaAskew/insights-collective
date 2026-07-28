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

  /**
   * The TipTap editors sanitize on every keystroke, so the allowlist must
   * cover everything their extensions emit — a missing tag here deletes
   * content while the user types. mark comes from Highlight; colspan/rowspan/
   * colwidth from the Table extensions.
   */
  it('keeps editor-emitted highlight marks and table span attributes', () => {
    const html =
      '<p><mark>hi</mark></p><table><tbody><tr><td colspan="2" rowspan="3" colwidth="120">x</td></tr></tbody></table>';
    const out = sanitizeHTML(html);
    expect(out).toContain('<mark>hi</mark>');
    expect(out).toContain('colspan="2"');
    expect(out).toContain('rowspan="3"');
    expect(out).toContain('colwidth="120"');
  });

  /**
   * The nested-tag bypass that defeated the old regex sanitizer: removing
   * `<script>` from `<scr<script>ipt>` reassembles `<script>`. A parser does
   * not have that failure mode — assert the payload cannot survive.
   */
  it('neutralises nested-tag reassembly payloads', () => {
    const out = sanitizeHTML('<scr<script>ipt>alert(1)</scr</script>ipt>');
    expect(out.toLowerCase()).not.toContain('<script');
    expect(out).not.toContain('onerror');
  });

  it('strips unquoted inline event handlers', () => {
    const out = sanitizeHTML('<img src=x onerror=alert(1)>');
    expect(out).not.toContain('onerror');
  });
});
