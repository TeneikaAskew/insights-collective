// ABOUTME: Simple placeholder view for builder sections that aren't fully implemented yet.
// ABOUTME: Used for Design templates, Certificates, Pricing, Sales pages, Students, Reports.

import { Lock } from 'lucide-react';
import { TeachableBreadcrumb } from './TeachableBreadcrumb';

interface PlaceholderViewProps {
  courseId?: string;
  courseTitle: string;
  title: string;
  description: string;
}

export function PlaceholderView({ courseId, courseTitle, title, description }: PlaceholderViewProps) {
  return (
    <div className="px-4 sm:px-6 lg:px-10 py-6 lg:py-10 max-w-[1200px] mx-auto">
      <TeachableBreadcrumb courseId={courseId} courseTitle={courseTitle} current={title} />

      <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl mb-4">{title}</h2>
      {/* Same lavender-chip treatment as the site-wide Coming Soon page
          (src/pages/ComingSoon.tsx), so a locked builder section and a locked
          page read as the same state instead of two unrelated empty cards. */}
      <div className="ss-card bg-card p-12 text-center">
        <div className="ss-chip rounded-full p-4 w-16 h-16 mx-auto mb-6 flex items-center justify-center">
          <Lock className="h-7 w-7" />
        </div>
        <h3 className="text-xl font-semibold text-foreground mb-3">
          This feature is not available yet
        </h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">{description}</p>
        <p className="text-xs text-muted-foreground mt-3">Coming soon in this workspace.</p>
      </div>
    </div>
  );
}

export default PlaceholderView;
