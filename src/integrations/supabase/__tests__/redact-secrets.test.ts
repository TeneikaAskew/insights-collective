import { describe, it, expect } from 'vitest';
import { redactUrl, redactText } from '../redact-secrets';

// A structurally valid JWT shape. Not a real credential — three base64url
// segments is all the pattern keys on.
const FAKE_JWT =
  'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0LXVzZXIiLCJleHAiOjF9.c2lnbmF0dXJlLXBsYWNlaG9sZGVy';

describe('redactUrl', () => {
  it('strips the token from a Supabase signed storage URL', () => {
    const out = redactUrl(
      `https://proj.supabase.co/storage/v1/object/sign/resumes/u/1.pdf?token=${FAKE_JWT}`,
    );
    expect(out).not.toContain(FAKE_JWT);
    expect(out).not.toContain('eyJ');
    // The path survives — knowing WHICH object failed is the point of the record.
    expect(out).toContain('/storage/v1/object/sign/resumes/u/1.pdf');
  });

  it('strips the private calendar feed token', () => {
    // The shape CourseCalendarSync.tsx builds.
    const out = redactUrl(
      'https://proj.supabase.co/functions/v1/course-calendar-feed?course_id=abc&token=s3cret-feed-token',
    );
    expect(out).not.toContain('s3cret-feed-token');
    expect(out).toContain('course_id=abc');
    // The parameter NAME stays, so a reader can tell a token was involved.
    expect(out).toContain('token=');
  });

  it('leaves a PostgREST query completely intact', () => {
    // This is the case the redactor must not break: the table, the selected
    // columns and the filter are how a rejected query gets diagnosed at all.
    const url =
      'https://proj.supabase.co/rest/v1/profiles?select=id,full_name,email&id=eq.42&order=created_at.desc';
    expect(redactUrl(url)).toBe(url);
  });

  it('redacts apikey and AWS signing parameters', () => {
    const out = redactUrl(
      'https://proj.supabase.co/rest/v1/courses?select=id&apikey=abc123&X-Amz-Signature=deadbeef',
    );
    expect(out).not.toContain('abc123');
    expect(out).not.toContain('deadbeef');
    expect(out).toContain('select=id');
  });

  it('catches sensitive names nobody enumerated', () => {
    const out = redactUrl(
      'https://example.com/f?feed_token=aaa&calendar-token=bbb&client_secret=ccc',
    );
    expect(out).not.toContain('aaa');
    expect(out).not.toContain('bbb');
    expect(out).not.toContain('ccc');
  });

  it('does not redact a column filter merely because it contains "key"', () => {
    // `key` is an exact match only. As a substring it would gut PostgREST
    // filters on any column named like this, for no safety gain.
    const url = 'https://proj.supabase.co/rest/v1/settings?select=id&keyword=eq.onboarding';
    expect(redactUrl(url)).toBe(url);
  });

  it('matches parameter names case-insensitively', () => {
    const out = redactUrl('https://example.com/f?Token=abc123&ACCESS_TOKEN=def456');
    expect(out).not.toContain('abc123');
    expect(out).not.toContain('def456');
  });

  it('still redacts when the URL does not parse', () => {
    // Truncation is real: the fixture slices recorded URLs at 400 chars, which
    // can cut a URL mid-way. Failing to parse must not mean failing to redact.
    const out = redactUrl(`/relative/path?token=${FAKE_JWT}`);
    expect(out).not.toContain(FAKE_JWT);
  });

  it('redacts a JWT sitting in the path rather than the query', () => {
    const out = redactUrl(`https://example.com/verify/${FAKE_JWT}/done`);
    expect(out).not.toContain(FAKE_JWT);
    expect(out).toContain('[redacted-jwt]');
  });

  it('passes through an ordinary URL and the empty string unchanged', () => {
    expect(redactUrl('https://example.com/courses/42')).toBe('https://example.com/courses/42');
    expect(redactUrl('')).toBe('');
  });
});

describe('redactText', () => {
  it('redacts a credential embedded in a browser resource error', () => {
    const out = redactText(
      `Failed to load resource: https://proj.supabase.co/storage/v1/object/sign/x?token=${FAKE_JWT} 400`,
    );
    expect(out).not.toContain(FAKE_JWT);
    expect(out).toContain('Failed to load resource');
  });

  it('redacts a bare JWT with no surrounding parameter', () => {
    const out = redactText(`Auth failed for bearer ${FAKE_JWT}`);
    expect(out).toBe('Auth failed for bearer [redacted-jwt]');
  });

  it('redacts every occurrence, not just the first', () => {
    const out = redactText(`a=1&token=one&b=2&apikey=two`);
    expect(out).not.toContain('one');
    expect(out).not.toContain('two');
    expect(out).toContain('a=1');
  });

  it('leaves ordinary error text alone', () => {
    const msg = 'column profiles.full_name does not exist';
    expect(redactText(msg)).toBe(msg);
  });
});
