// ABOUTME: Resilient course cover image with app-owned artwork fallbacks.
// ABOUTME: Missing or blocked remote covers resolve to a stable cover based on the course name.

import React, { useEffect, useMemo, useState } from 'react';
import collaborationCover from '@/assets/course-cover-collaboration.jpg';
import leadershipCover from '@/assets/course-cover-leadership.jpg';
import strategyCover from '@/assets/course-cover-strategy.jpg';

interface CourseImageProps {
  src?: string | null;
  alt: string;
  className?: string;
}

export const CourseImage: React.FC<CourseImageProps> = ({ src, alt, className }) => {
  const [failed, setFailed] = useState(false);
  const fallbackSrc = useMemo(() => {
    const covers = [collaborationCover, strategyCover, leadershipCover];
    const hash = Array.from(alt).reduce((total, character) => total + character.charCodeAt(0), 0);
    return covers[hash % covers.length];
  }, [alt]);

  useEffect(() => setFailed(false), [src]);

  const imageSrc = !src || failed ? fallbackSrc : src;

  return (
    <img
      src={imageSrc}
      alt={alt}
      className={className ?? 'w-full h-full object-cover'}
      loading="lazy"
      width={1200}
      height={750}
      onError={() => {
        if (imageSrc !== fallbackSrc) setFailed(true);
      }}
    />
  );
};
