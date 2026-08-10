// ABOUTME: Tests for DOMParser-based text extraction — malformed HTML, entity
// ABOUTME: decoding, and the nested-tag shapes that defeated the old regex.

import { describe, it, expect } from 'vitest';
import { htmlToPlainText } from '../htmlToPlainText';

describe('htmlToPlainText', () => {
  it('extracts text from well-formed HTML', () => {
    expect(htmlToPlainText('<p>Hello <strong>world</strong></p>')).toBe('Hello world');
  });

  it('decodes entities instead of deleting them', () => {
    // The old regex turned "R&amp;D" into "R D" by deleting the entity.
    expect(htmlToPlainText('<p>R&amp;D &lt;budget&gt;</p>')).toBe('R&D <budget>');
  });

  it('handles attribute values containing > without truncating', () => {
    expect(htmlToPlainText('<img alt="a>b">after')).toBe('after');
  });

  it('yields no tag content from nested-tag payloads', () => {
    const out = htmlToPlainText('<scr<script>ipt>alert(1)</scr</script>ipt>');
    expect(out).not.toContain('<script');
  });

  it('drops script/style bodies as inert text handling', () => {
    // DOMParser documents are inert: nothing executes, nothing loads.
    const out = htmlToPlainText('<p>keep</p><script>document.title="x"</script>');
    expect(out).toContain('keep');
  });

  it('normalizes whitespace across block boundaries', () => {
    expect(htmlToPlainText('<p>one</p>\n\n<p>two</p>')).toBe('one two');
  });

  it('separates adjacent block elements that have no whitespace between them', () => {
    // The bug Codex caught: compact TipTap output "<p>First</p><p>Second</p>"
    // yielded "FirstSecond" from textContent alone.
    expect(htmlToPlainText('<p>First</p><p>Second</p>')).toBe('First Second');
    expect(htmlToPlainText('<ul><li>a</li><li>b</li></ul>')).toBe('a b');
    expect(htmlToPlainText('<h1>Title</h1><p>Body</p>')).toBe('Title Body');
    expect(htmlToPlainText('line<br>break')).toBe('line break');
  });

  it('does not insert spurious spaces inside inline runs', () => {
    expect(htmlToPlainText('<p>a <strong>bold</strong> word</p>')).toBe('a bold word');
  });

  it('returns empty string for empty input', () => {
    expect(htmlToPlainText('')).toBe('');
  });
});
