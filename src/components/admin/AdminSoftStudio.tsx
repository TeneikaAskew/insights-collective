// ABOUTME: Shared wrapper that renders an admin page inside the scoped Soft
// ABOUTME: Studio theme. Mirrors the Resume page pattern (src/pages/Resume.tsx)
// ABOUTME: so the sidebar/navbar keep the site theme while the page adopts the
// ABOUTME: warm plaster / lavender look. Reused across the admin section.

import React from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { cn } from '@/lib/utils';

interface AdminSoftStudioProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * The `.soft-studio` class (src/index.css) overrides shadcn tokens inside this
 * subtree only; `ss-wash` paints the warm radial background. Radix overlays
 * (Sheet/Dialog/AlertDialog) portal to document.body OUTSIDE this subtree, so
 * their content elements must each add `className="soft-studio"` to stay themed.
 */
export function AdminSoftStudio({ children, className }: AdminSoftStudioProps) {
  return (
    <AppLayout fullWidth>
      <div className={cn('soft-studio ss-wash min-h-full w-full px-4 py-8 sm:px-6', className)}>
        <div className="mx-auto w-full max-w-6xl">{children}</div>
      </div>
    </AppLayout>
  );
}

export default AdminSoftStudio;
