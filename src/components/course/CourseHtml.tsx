import { useEffect, useState } from 'react';
import { sanitizeHTML } from '@/utils/sanitize';
import { resolveHtmlCourseAssets } from '@/utils/storageAssets';

interface CourseHtmlProps {
  html: string | null | undefined;
  className?: string;
}

/**
 * Renders course/lesson HTML with private-bucket asset URLs (course-images,
 * course-videos, course-documents) re-signed at read time, then sanitized.
 *
 * Drop-in replacement for
 *   <div dangerouslySetInnerHTML={{ __html: sanitizeHTML(content) }} />
 *
 * Sanitized content shows immediately; signed asset URLs swap in once resolved,
 * so there is no blank render while the (async) signing round-trips.
 */
export function CourseHtml({ html, className }: CourseHtmlProps) {
  const base = html || '';
  const [resolved, setResolved] = useState<string>(() => sanitizeHTML(base));

  useEffect(() => {
    let cancelled = false;
    setResolved(sanitizeHTML(base));
    resolveHtmlCourseAssets(base)
      .then((withSigned) => {
        if (!cancelled && withSigned !== base) setResolved(sanitizeHTML(withSigned));
      })
      .catch(() => {
        /* keep the sanitized, unsigned fallback */
      });
    return () => {
      cancelled = true;
    };
  }, [base]);

  return <div className={className} dangerouslySetInnerHTML={{ __html: resolved }} />;
}

export default CourseHtml;
