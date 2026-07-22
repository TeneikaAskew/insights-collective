// ABOUTME: Dark-rail Teachable-style shell for the instructor builder.
// ABOUTME: Renders the left nav (Setup guide, Curriculum, Design, Pricing…) and the main area.

import { useState, type ReactNode } from 'react';
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
  Menu,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Hint } from '@/components/ui/hint';

export type BuilderNavKey =
  | 'setup'
  | 'curriculum'
  | 'lesson'
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
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleNav = (key: BuilderNavKey) => {
    setDrawerOpen(false);
    onNavigate(key);
  };

  const sidebarBody = (
    <>
      <div className="px-5 pt-5 pb-4">
        <Link
          to="/admin/courses"
          className="inline-flex items-center gap-1.5 text-xs uppercase tracking-widest font-semibold text-sidebar-foreground/80 hover:text-sidebar-foreground"
        >
          <ArrowLeft className="h-3 w-3" />
          Courses
        </Link>
        <h1
          className="mt-4 text-lg leading-snug line-clamp-3 font-semibold text-foreground"
          title={courseTitle}
        >
          {courseTitle || 'Untitled course'}
        </h1>
      </div>

      <nav className="px-3 pb-4 space-y-1 flex-1 overflow-y-auto">
        <NavGroup items={primary} activeKey={activeKey} onNavigate={handleNav} />
        <div className="my-4 border-t border-sidebar-border" />
        <NavGroup items={secondary} activeKey={activeKey} onNavigate={handleNav} />
      </nav>
    </>
  );

  return (
    <div
      className="teachable-workspace fixed inset-0 flex font-sans"
      style={{
        background: 'hsl(var(--tw-page))',
        color: 'hsl(var(--tw-text))',
      }}
    >
      {/* Desktop left rail */}
      <aside
        data-onboarding="builder-nav"
        className="hidden lg:flex w-64 flex-shrink-0 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border"
      >
        {sidebarBody}
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <Hint label="Close navigation menu">
            <button
              type="button"
              aria-label="Close menu"
              className="absolute inset-0 bg-black/50"
              onClick={() => setDrawerOpen(false)}
            />
          </Hint>
          <aside className="relative flex flex-col w-72 max-w-[85vw] bg-sidebar text-sidebar-foreground border-r border-sidebar-border shadow-xl">
            <Hint label="Close navigation menu">
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="absolute top-3 right-3 p-2 rounded-md hover:bg-sidebar-accent text-sidebar-foreground"
                aria-label="Close menu"
              >
                <X className="h-4 w-4" />
              </button>
            </Hint>
            {sidebarBody}
          </aside>
        </div>
      )}

      {/* Main area */}
      <main className="flex-1 flex flex-col min-w-0">
        <header
          className="h-16 px-4 md:px-8 flex items-center gap-3 bg-white flex-shrink-0"
          style={{ borderBottom: '1px solid hsl(var(--tw-border))' }}
        >
          <Hint label="Open course navigation">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="lg:hidden p-2 -ml-2 rounded-md hover:bg-gray-100 text-foreground"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
          </Hint>
          <div className="flex-1 min-w-0 lg:hidden">
            <div className="text-sm font-semibold truncate">{courseTitle || 'Untitled course'}</div>
          </div>
          <div className="flex items-center gap-2 md:gap-3 ml-auto">
            {previewHref && (
              <Hint label="See what students see for this course">
                <Link
                  data-onboarding="builder-preview"
                  to={previewHref}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-xs md:text-sm font-semibold border hover:bg-gray-50 transition-colors"
                  style={{ borderColor: 'hsl(var(--tw-border))' }}
                >
                  <Eye className="h-4 w-4" />
                  <span className="hidden sm:inline">Preview</span>
                </Link>
              </Hint>
            )}
            <Hint label={published ? 'Hide this course from students' : 'Make this course visible to students'}>
              <button
                data-onboarding="builder-publish"
                type="button"
                onClick={() => onTogglePublish(!published)}
                className="inline-flex items-center gap-2 px-3 md:px-4 py-2 rounded-md text-xs md:text-sm font-bold transition-transform hover:scale-[1.02] whitespace-nowrap"
                style={{
                  background: published ? 'hsl(var(--muted))' : 'hsl(var(--primary))',
                  color: published ? 'hsl(var(--muted-foreground))' : 'hsl(var(--primary-foreground))',
                }}
              >
                {published ? 'Unpublish' : 'Publish'}
                <span className="hidden md:inline">{published ? ' course' : ' your course'}</span>
              </button>
            </Hint>
          </div>
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
                ? 'bg-primary text-primary-foreground font-semibold'
                : 'text-primary hover:bg-primary hover:text-primary-foreground',
            )}
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
