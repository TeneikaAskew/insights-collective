
// Security configuration and environment validation
import { sanitizeInput } from '@/utils/securityUtils';

/**
 * A Supabase URL is acceptable if it is HTTPS, or if it is plain HTTP pointed at
 * this machine.
 *
 * The point of the check is that credentials and user data must never cross a
 * network in the clear. A loopback address never leaves the machine, so the
 * threat the rule exists to stop cannot occur there.
 *
 * The previous `startsWith('https://')` test rejected loopback too, which broke
 * two legitimate setups:
 *
 *   - `supabase start`, which CLAUDE.md documents, serves the local stack on
 *     http://127.0.0.1:54321. The guard made the documented local workflow
 *     impossible.
 *   - scripts/e2e/supabase-relay.mjs, which lets the browser reach the project
 *     from an environment whose egress proxy it cannot use.
 *
 * Anything else non-HTTPS is still rejected, including hostnames that merely
 * look local — `localhost.example.com` is a remote host.
 */
export function isAllowedSupabaseUrl(raw: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return false;
  }
  if (parsed.protocol === 'https:') return true;
  if (parsed.protocol !== 'http:') return false;
  // URL.hostname keeps the brackets on an IPv6 literal, so match both forms.
  return ['localhost', '127.0.0.1', '[::1]', '::1'].includes(parsed.hostname);
}

// Validate and sanitize environment configuration
export const securityConfig = {
  // Supabase configuration with validation
  supabase: {
    url: (() => {
      const url = import.meta.env.VITE_SUPABASE_URL || "https://siuqvhscuiycvdrtiqsh.supabase.co";
      if (!isAllowedSupabaseUrl(url)) {
        throw new Error(
          `Supabase URL must use HTTPS (got ${url}). Plain HTTP is allowed only for ` +
            `localhost, 127.0.0.1 or [::1] — a local stack or relay.`,
        );
      }
      return url;
    })(),
    key: (() => {
      const key = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpdXF2aHNjdWl5Y3ZkcnRpcXNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQyMDU0MTUsImV4cCI6MjA1OTc4MTQxNX0.CbAWzKbUfbqYKAZr93jAQm8z8chbNoTe0EnK-E_4u9w";
      if (!key || key.length < 20) {
        throw new Error('Invalid Supabase anonymous key');
      }
      return key;
    })()
  },

  // Content Security Policy configuration
  csp: {
    defaultSrc: ["'self'"],
    // cdn.jsdelivr.net (Monaco) and esm.sh dropped: Monaco is bundled and served
    // from this origin, and esm.sh is imported only by the Deno edge functions,
    // which a browser CSP does not govern. cdn.gpteng.co stays — it is Lovable's
    // editor script and it does load in the browser.
    scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.gpteng.co"],
    styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
    fontSrc: ["'self'", "https://fonts.gstatic.com"],
    imgSrc: ["'self'", "data:", "https:", "blob:"],
    // SecurityHeaders.tsx appends the configured Supabase origin here when it is
    // a loopback http URL, so `supabase start` and the e2e relay can be reached.
    // A deployed build points at https and nothing is added.
    connectSrc: ["'self'", "wss:", "https:"],
    frameSrc: ["'self'", "https://www.youtube.com", "https://www.youtube-nocookie.com", "https://youtube.com", "https://player.vimeo.com"],
    objectSrc: ["'none'"],
    baseUri: ["'self'"]
  },

  // Input validation rules
  validation: {
    maxContentLength: 50000, // Max content length for posts/blogs
    maxTitleLength: 200,
    maxDescriptionLength: 1000,
    allowedFileTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'],
    maxFileSize: 10 * 1024 * 1024 // 10MB
  },

  // Rate limiting configuration
  rateLimiting: {
    loginAttempts: { max: 5, windowMs: 15 * 60 * 1000 }, // 5 attempts per 15 minutes
    registrationAttempts: { max: 3, windowMs: 60 * 60 * 1000 }, // 3 attempts per hour
    apiRequests: { max: 100, windowMs: 60 * 1000 }, // 100 requests per minute
    formSubmissions: { max: 10, windowMs: 60 * 1000 } // 10 submissions per minute
  }
};

// Enhanced input sanitization wrapper
export const sanitizeUserInput = (input: string, maxLength?: number): string => {
  if (!input) return '';
  
  let sanitized = sanitizeInput(input);
  
  if (maxLength && sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }
  
  return sanitized;
};

// Validate file uploads
export const validateFileUpload = (file: File): { valid: boolean; error?: string } => {
  if (!securityConfig.validation.allowedFileTypes.includes(file.type)) {
    return { valid: false, error: 'File type not allowed' };
  }
  
  if (file.size > securityConfig.validation.maxFileSize) {
    return { valid: false, error: 'File too large' };
  }
  
  return { valid: true };
};

// Validate URLs to prevent open redirects
export const validateRedirectUrl = (url: string): boolean => {
  if (!url) return false;
  
  // Allow relative URLs starting with /
  if (url.startsWith('/') && !url.startsWith('//')) {
    return true;
  }
  
  // Allow only specific domains for absolute URLs
  const allowedDomains = [
    'insightscollective.org',
    'preview--insights-collective.lovable.app',
    'localhost',
    '127.0.0.1'
  ];
  
  try {
    const urlObj = new URL(url);
    return allowedDomains.some(domain => 
      urlObj.hostname === domain || urlObj.hostname.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
};
