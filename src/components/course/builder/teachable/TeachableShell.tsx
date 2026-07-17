// ABOUTME: Dark-rail Teachable-style shell for the instructor builder.
// ABOUTME: Renders the left nav (Setup guide, Curriculum, Design, Pricing…) and the main area.

import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  LayoutGrid,
  ListChecks,
  Palette,
  Award,
  Info,
  DollarSign,
  Megaphone,
  Users,
  BarChart3,
  ArrowLeft,
  Eye,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type BuilderNavKey =
  | 'setup'
  | 'curriculum'
  | 'design'
  | 'certificates'
  | 'information'
  | 'pricing'
  | 'sales'
  | 'students'
  | 'reports';

interface TeachableShellProps {
  courseTitle: string;
  published: boolean;
  activeKey: BuilderNavKey;
  onNavigate: (key: BuilderNavKey) => void;
  onTogglePublish: (next: boolean) => void;
  previewHref?: string;
  children: ReactNode;
}

const NAV_ITEMS: {
  key: BuilderNavKey;
  label: string;
  icon: typeof LayoutGrid;
  group: 'primary' | 'secondary';
}[] = [
  { key: 'setup', label: 'Setup guide', icon: LayoutGrid, group: 'primary' },
  { key: 'curriculum', label: 'Curriculum', icon: ListChecks, group: 'primary' },
  { key: 'design', label: 'Design templates', icon: Palette, group: 'primary' },
  { key: 'certificates', label: 'Certificates', icon: Award, group: 'primary' },
  { key: 'information', label: 'Information', icon: Info, group: 'primary' },
  { key: 'pricing', label: 'Pricing', icon: DollarSign, group: 'secondary' },
  { key: 'sales', label: 'Sales pages', icon: Megaphone, group: 'secondary' },
  { key: 'students', label: 'Students', icon: Users, group: 'secondary' },
  { key: 'reports', label: 'Reports', icon: BarChart3, group: 'secondary' },
];

export function TeachableShell({
  courseTitle,
  published,
  activeKey,
  onNavigate,
  onTogglePublish,
  previewHref,
  children,
}: TeachableShellProps) {
  const primary = NAV_ITEMS.filter((n) => n.group === 'primary');
  const secondary = NAV_ITEMS.filter((n) => n.group === 'secondary');

  return (
    <div
      className="teachable-workspace fixed inset-0 flex font-sans"
      style={{
        background: 'hsl(var(--tw-page))',
        color: 'hsl(var(--tw-text))',
      }}
    >
      {/* Left dark rail */}
      <aside
        className="w-64 flex-shrink-0 flex flex-col"
        style={{
          background: 'hsl(var(--tw-rail))',
          color: 'hsl(var(--tw-rail-text))',
        }}
      >
        <div className="px-5 pt-5 pb-4">
          <Link
            to="/admin/courses"
            className="inline-flex items-center gap-1.5 text-xs uppercase tracking-widest font-semibold opacity-70 hover:opacity-100"
          >
            <ArrowLeft className="h-3 w-3" />
            Courses
          </Link>
          <h1
            className="mt-4 text-lg leading-snug line-clamp-3"
            title={courseTitle}
            style={{ fontWeight: 600 }}
          >
            {courseTitle || 'Untitled course'}
          </h1>
        </div>

        <nav className="px-3 pb-4 space-y-1 flex-1 overflow-y-auto">
          <NavGroup
            items={primary}
            activeKey={activeKey}
            onNavigate={onNavigate}
          />
          <div className="my-4 border-t" style={{ borderColor: 'hsl(0 0% 20%)' }} />
          <NavGroup
            items={secondary}
            activeKey={activeKey}
            onNavigate={onNavigate}
          />
        </nav>
      </aside>

      {/* Main area */}
      <main className="flex-1 flex flex-col min-w-0">
        <header
          className="h-16 px-8 flex items-center justify-end gap-3 bg-white flex-shrink-0"
          style={{ borderBottom: '1px solid hsl(var(--tw-border))' }}
        >
          {previewHref && (
            <Link
              to={previewHref}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md text-sm font-semibold border hover:bg-gray-50 transition-colors"
              style={{ borderColor: 'hsl(var(--tw-border))' }}
            >
              <Eye className="h-4 w-4" />
              Preview
            </Link>
          )}
          <button
            type="button"
            onClick={() => onTogglePublish(!published)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-bold transition-transform hover:scale-[1.02]"
            style={{
              background: published ? '#111' : 'hsl(var(--tw-accent))',
              color: published ? '#fff' : 'hsl(var(--tw-accent-ink))',
            }}
          >
            {published ? 'Unpublish course' : 'Publish your course'}
          </button>
        </header>

        <div className="flex-1 overflow-y-auto">{children}</div>
      </main>
    </div>
  );
}

function NavGroup({
  items,
  activeKey,
  onNavigate,
}: {
  items: { key: BuilderNavKey; label: string; icon: typeof LayoutGrid }[];
  activeKey: BuilderNavKey;
  onNavigate: (key: BuilderNavKey) => void;
}) {
  return (
    <div className="space-y-0.5">
      {items.map(({ key, label, icon: Icon }) => {
        const active = key === activeKey;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onNavigate(key)}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-left transition-colors',
              active
                ? 'text-white'
                : 'text-gray-300 hover:text-white hover:bg-white/5',
            )}
            style={
              active
                ? {
                    background: 'hsl(var(--tw-accent))',
                    color: 'hsl(var(--tw-accent-ink))',
                    fontWeight: 700,
                  }
                : undefined
            }
          >
            <Icon className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default TeachableShell;
