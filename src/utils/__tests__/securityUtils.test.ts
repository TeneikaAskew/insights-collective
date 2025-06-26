import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateSessionIntegrity } from '../securityUtils';

describe('securityUtils', () => {
  describe('validateSessionIntegrity', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should validate a valid session', () => {
      const validSession = {
        access_token: 'valid-token-123',
        refresh_token: 'refresh-token-456',
        expires_at: Date.now() / 1000 + 3600, // 1 hour from now
        user: {
          id: 'user-123',
          email: 'test@example.com',
        },
      };

      expect(validateSessionIntegrity(validSession as any)).toBe(true);
    });

    it('should reject session without access token', () => {
      const invalidSession = {
        refresh_token: 'refresh-token-456',
        expires_at: Date.now() / 1000 + 3600,
        user: {
          id: 'user-123',
          email: 'test@example.com',
        },
      };

      expect(validateSessionIntegrity(invalidSession as any)).toBe(false);
    });

    it('should reject expired session', () => {
      const expiredSession = {
        access_token: 'valid-token-123',
        refresh_token: 'refresh-token-456',
        expires_at: Date.now() / 1000 - 3600, // 1 hour ago
        user: {
          id: 'user-123',
          email: 'test@example.com',
        },
      };

      expect(validateSessionIntegrity(expiredSession as any)).toBe(false);
    });

    it('should reject session without user', () => {
      const sessionWithoutUser = {
        access_token: 'valid-token-123',
        refresh_token: 'refresh-token-456',
        expires_at: Date.now() / 1000 + 3600,
      };

      expect(validateSessionIntegrity(sessionWithoutUser as any)).toBe(false);
    });

    it('should handle null session', () => {
      expect(validateSessionIntegrity(null as any)).toBe(false);
    });

    it('should handle undefined session', () => {
      expect(validateSessionIntegrity(undefined as any)).toBe(false);
    });

    it('should reject session with invalid token format', () => {
      const sessionWithInvalidToken = {
        access_token: '',
        refresh_token: 'refresh-token-456',
        expires_at: Date.now() / 1000 + 3600,
        user: {
          id: 'user-123',
          email: 'test@example.com',
        },
      };

      expect(validateSessionIntegrity(sessionWithInvalidToken as any)).toBe(false);
    });
  });
});