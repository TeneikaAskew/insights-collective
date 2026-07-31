// ABOUTME: Course cover image that degrades to the neutral placeholder block
// ABOUTME: instead of the browser's broken-image icon when the source fails —
// ABOUTME: cover art has broken before when an external host stopped serving it.

import React, { useState } from 'react';

interface CourseImageProps {
  src?: string | null;
  alt: string;
  className?: string;
}

export const CourseImage: React.FC<CourseImageProps> = ({ src, alt, className }) => {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    // No artwork (or unloadable artwork) — neutral block, never a broken icon.
    return <div className="w-full h-full bg-muted" aria-hidden="true" />;
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className ?? 'w-full h-full object-cover'}
      onError={() => setFailed(true)}
    />
  );
};
