import { describe, it, expect } from 'vitest';
import { safeInternalPath, DEFAULT_REDIRECT } from '../safeRedirect';

describe('safeInternalPath', () => {
  describe('rejects targets that leave the origin', () => {
    const escapes = [
      'https://evil.com',
      'http://evil.com/path',
      '//evil.com',
      '///evil.com',
      '/\\evil.com',
      '\\\\evil.com',
      '\\/evil.com',
      'javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'mailto:someone@example.com',
      'evil.com',
      '/\\/evil.com',
    ];

    it.each(escapes)('rejects %j', (candidate) => {
      expect(safeInternalPath(candidate)).toBe(DEFAULT_REDIRECT);
    });
  });

  describe('preserves genuine internal paths', () => {
    it('keeps a simple path', () => {
      expect(safeInternalPath('/courses/123')).toBe('/courses/123');
    });

    it('keeps query strings and fragments', () => {
      expect(safeInternalPath('/search?q=data&page=2#results')).toBe(
        '/search?q=data&page=2#results'
      );
    });

    it('keeps a path containing a colon in the query', () => {
      expect(safeInternalPath('/search?q=a:b')).toBe('/search?q=a:b');
    });

    it('resolves traversal segments rather than rejecting them', () => {
      expect(safeInternalPath('/courses/../dashboard')).toBe('/dashboard');
    });
  });

  describe('handles absent or malformed input', () => {
    it.each([undefined, null, '', 0, {}, []])('falls back for %j', (candidate) => {
      expect(safeInternalPath(candidate)).toBe(DEFAULT_REDIRECT);
    });

    it('honors a custom fallback', () => {
      expect(safeInternalPath('https://evil.com', '/login')).toBe('/login');
    });
  });
});
