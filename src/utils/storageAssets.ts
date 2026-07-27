// Signed-URL resolution for private course storage buckets.
//
// course-images / course-videos / course-documents are private buckets (read is
// gated by can_access_course_materials via RLS). `getPublicUrl` produces a
// `/object/public/...` link that returns nothing for a private bucket, and an
// <img>/<a> request carries no Authorization header, so a stored public URL is
// unusable even for an authorized viewer. These helpers resolve a fresh,
// short-lived signed URL at read time instead.
//
// A stored reference may be a public URL, an (expired) signed URL, or a bare
// path — all of them embed the bucket and object path, so we parse it back out
// and re-sign with the caller's session. The caller must be able to read the
// object under RLS (enrolled students and course staff can), which is exactly
// the access boundary we want.

import { supabase } from '@/integrations/supabase/client';

export const PRIVATE_COURSE_BUCKETS = [
  'course-images',
  'course-videos',
  'course-documents',
] as const;

const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour

// Matches Supabase Storage object URLs in any access mode and captures the
// bucket and the object path (before any query string).
const STORAGE_URL_RE =
  /\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/([^?]+)/;

interface BucketRef {
  bucket: string;
  path: string;
}

/** Pull {bucket, path} out of a stored reference, or null if it isn't one of ours. */
export function parseCourseAssetRef(reference: string): BucketRef | null {
  if (!reference) return null;

  const match = reference.match(STORAGE_URL_RE);
  if (match) {
    const [, bucket, rawPath] = match;
    if (!PRIVATE_COURSE_BUCKETS.includes(bucket as (typeof PRIVATE_COURSE_BUCKETS)[number])) {
      return null;
    }
    let path = rawPath;
    try {
      path = decodeURIComponent(rawPath);
    } catch {
      /* keep raw path if it is not valid percent-encoding */
    }
    return { bucket, path };
  }

  return null;
}

/**
 * Resolve a single stored reference to a usable URL. Private-bucket references
 * are re-signed; anything else (public bucket, external URL, data URI) is
 * returned unchanged so existing content keeps working.
 */
export async function resolveCourseAssetUrl(reference: string): Promise<string> {
  const ref = parseCourseAssetRef(reference);
  if (!ref) return reference;

  const { data, error } = await supabase.storage
    .from(ref.bucket)
    .createSignedUrl(ref.path, SIGNED_URL_TTL_SECONDS);

  // On failure, fall back to the original reference rather than blanking the
  // asset — no worse than before, and avoids throwing inside a render path.
  if (error || !data?.signedUrl) return reference;
  return data.signedUrl;
}

/**
 * Rewrite every private-bucket asset reference inside an HTML fragment to a
 * fresh signed URL. Covers <img src>, <source src>, <video src>/<video poster>
 * and <a href>. Returns the HTML unchanged if it references no private assets.
 */
export async function resolveHtmlCourseAssets(html: string): Promise<string> {
  if (!html) return html;

  // Collect the distinct raw references that need signing.
  const attrRe = /(?:src|href|poster)\s*=\s*(["'])(.*?)\1/gi;
  const refs = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = attrRe.exec(html)) !== null) {
    if (parseCourseAssetRef(m[2])) refs.add(m[2]);
  }
  if (refs.size === 0) return html;

  // Sign them once each, then substitute.
  const pairs = await Promise.all(
    Array.from(refs).map(async (raw) => [raw, await resolveCourseAssetUrl(raw)] as const),
  );

  let out = html;
  for (const [raw, signed] of pairs) {
    if (raw === signed) continue;
    out = out.split(raw).join(signed);
  }
  return out;
}
