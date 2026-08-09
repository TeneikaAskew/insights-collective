
// Security headers component for CSP and other security measures
import { useEffect } from 'react';
import { securityConfig } from '@/config/security';

/**
 * `connect-src` allows `https:` and `wss:` but not `http:`, which is right for a
 * deployed app and wrong for the two supported local setups:
 *
 *   - `supabase start`, documented in CLAUDE.md, serves on http://127.0.0.1:54321
 *   - scripts/e2e/supabase-relay.mjs, which the e2e suite uses on a loopback port
 *
 * Both were silently blocked. The request never left the browser, so it surfaced
 * as a bare "TypeError: Failed to fetch" with no mention of CSP — the app looked
 * like it had lost its database.
 *
 * Rather than open `http:` wholesale, allow exactly the origin the app is
 * configured to talk to, and only when that origin is loopback. A deployed build
 * points at https and this adds nothing at all.
 */
function localSupabaseOrigin(): string | null {
  try {
    const url = new URL(securityConfig.supabase.url);
    if (url.protocol !== 'http:') return null;
    return ['localhost', '127.0.0.1', '[::1]', '::1'].includes(url.hostname) ? url.origin : null;
  } catch {
    return null;
  }
}

export const SecurityHeaders = () => {
  useEffect(() => {
    const localOrigin = localSupabaseOrigin();

    /**
     * Realtime opens `ws://<origin>/realtime/v1/websocket` against that same
     * loopback host, and a scheme is not a wildcard: `wss:` does not cover
     * `ws:`, and `http://localhost:54399` does not cover `ws://localhost:54399`.
     * So every realtime subscription — notifications, messages, presence — was
     * blocked under `supabase start` and under the e2e relay, with the failure
     * arriving only as a console line no test read. Deployed builds are https
     * and use `wss:`, which was always allowed, so this adds nothing there.
     */
    const localWsOrigin = localOrigin ? localOrigin.replace(/^http:/, 'ws:') : null;
    const connectSrc = ["connect-src 'self' wss: https:", localOrigin, localWsOrigin]
      .filter(Boolean)
      .join(' ');

    /**
     * Storage serves avatars and course art from that same origin, so `img-src`
     * needs the exemption for the same reason `connect-src` does — and did not
     * have it. `'self'` is the dev server's port, not Supabase's, and `https:`
     * does not cover a loopback `http:` origin, so every uploaded image was
     * blocked under `supabase start` and under the e2e relay. Firefox reports
     * the violation to the console, which is how it surfaced; the picture is
     * simply missing either way.
     */
    const imgSrc = ["img-src 'self' data: https: blob:", localOrigin].filter(Boolean).join(' ');

    // Set Content Security Policy via meta tag
    const cspMeta = document.createElement('meta');
    cspMeta.httpEquiv = 'Content-Security-Policy';
    cspMeta.content = [
      "default-src 'self'",
      // cdn.jsdelivr.net was here for Monaco, which is bundled now and served
      // from this origin; esm.sh is imported only by the Deno edge functions,
      // where a browser CSP does not apply. Neither is reachable from any page,
      // and a script-src entry that outlives its subject is a standing
      // permission for whatever shows up at that host next.
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      imgSrc,
      connectSrc,
      "frame-src 'self' blob: https://www.youtube.com https://www.youtube-nocookie.com https://youtube.com https://player.vimeo.com",
      "object-src 'none'",
      "base-uri 'self'"
    ].join('; ');
    
    // Only add if not already present
    if (!document.querySelector('meta[http-equiv="Content-Security-Policy"]')) {
      document.head.appendChild(cspMeta);
    }

    // Set additional security headers via meta tags
    const headers = [
      { name: 'X-Content-Type-Options', content: 'nosniff' },
      { name: 'X-Frame-Options', content: 'SAMEORIGIN' },
      { name: 'X-XSS-Protection', content: '1; mode=block' },
      { name: 'Referrer-Policy', content: 'strict-origin-when-cross-origin' }
    ];

    headers.forEach(({ name, content }) => {
      if (!document.querySelector(`meta[name="${name}"]`)) {
        const meta = document.createElement('meta');
        meta.name = name;
        meta.content = content;
        document.head.appendChild(meta);
      }
    });

    // Check if we're in production mode (using import.meta.env instead of process.env)
    const isProduction = import.meta.env.MODE === 'production';

    // Disable right-click context menu in production (optional security measure)
    const handleContextMenu = (e: MouseEvent) => {
      if (isProduction) {
        e.preventDefault();
      }
    };

    // Disable F12 and other dev tools shortcuts in production
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isProduction) {
        // Block F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U
        if (
          e.key === 'F12' ||
          (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J')) ||
          (e.ctrlKey && e.key === 'u')
        ) {
          e.preventDefault();
        }
      }
    };

    if (isProduction) {
      document.addEventListener('contextmenu', handleContextMenu);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      if (isProduction) {
        document.removeEventListener('contextmenu', handleContextMenu);
        document.removeEventListener('keydown', handleKeyDown);
      }
    };
  }, []);

  return null; // This component doesn't render anything
};
