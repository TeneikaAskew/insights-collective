// ABOUTME: Shared wrapper that renders an admin page on the Soft Studio wash
// ABOUTME: with the standard content column. Soft Studio tokens are global now;
// ABOUTME: this wrapper only supplies layout (AppLayout + ss-wash + max-width).

import React from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { cn } from '@/lib/utils';

interface AdminSoftStudioProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * `ss-wash` paints the warm radial background; theme tokens come from :root,
 * so portaled Radix overlays are themed automatically.
 */
export function AdminSoftStudio({ children, className }: AdminSoftStudioProps) {
  return (
    <AppLayout fullWidth>
      <div className={cn('ss-wash min-h-full w-full px-4 py-8 sm:px-6', className)}>
        <div className="mx-auto w-full max-w-6xl">{children}</div>
      </div>
    </AppLayout>
  );
}

export default AdminSoftStudio;
