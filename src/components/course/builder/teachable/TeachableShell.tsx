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
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Hint } from '@/components/ui/hint';
import { Badge } from '@/components/ui/badge';
import {
  SIDEBAR_NAV_ACTIVE,
  SIDEBAR_NAV_INACTIVE,
  SIDEBAR_NAV_ITEM_BASE,
  sidebarNavIconClass,
} from '@/lib/sidebarNav';

export type BuilderNavKey =
  | 'setup'
  | 'curriculum'
  | 'lesson'
  | 'design'
  | 'certificates'
  | 'information'
  | 'settings'
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
  comingSoon?: boolean;
}[] = [
  { key: 'setup', label: 'Setup guide', icon: LayoutGrid, group: 'primary' },
  { key: 'curriculum', label: 'Curriculum', icon: ListChecks, group: 'primary' },
  { key: 'design', label: 'Design templates', icon: Palette, group: 'primary' },
  { key: 'certificates', label: 'Certificates', icon: Award, group: 'primary' },
  { key: 'information', label: 'Information', icon: Info, group: 'primary' },
  { key: 'settings', label: 'Settings', icon: Settings, group: 'primary' },
  // These sections are placeholders — the nav must say so up front instead of
  // presenting them as working features.
  { key: 'pricing', label: 'Pricing', icon: DollarSign, group: 'secondary', comingSoon: true },
  { key: 'sales', label: 'Sales pages', icon: Megaphone, group: 'secondary', comingSoon: true },
  { key: 'students', label: 'Students', icon: Users, group: 'secondary', comingSoon: true },
  { key: 'reports', label: 'Reports', icon: BarChart3, group: 'secondary', comingSoon: true },
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

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('builderNavCollapsed') === '1';
  });

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('builderNavCollapsed', next ? '1' : '0');
      }
      return next;
    });
  };

  const handleNav = (key: BuilderNavKey) => {
    setDrawerOpen(false);
    onNavigate(key);
  };

  const renderSidebarBody = (isCollapsed: boolean) => (
    <>
      <div className={cn('pt-5 pb-4', isCollapsed ? 'px-2' : 'px-5')}>
        <Link
          to="/admin/courses"
          className={cn(
            'inline-flex items-center gap-1.5 text-xs uppercase tracking-widest font-semibold text-sidebar-foreground/80 hover:text-sidebar-foreground',
            isCollapsed && 'justify-center w-full',
          )}
          title="Back to courses"
        >
          <ArrowLeft className="h-3 w-3" />
          {!isCollapsed && 'Courses'}
        </Link>
        {!isCollapsed && (
          <h1
            className="mt-4 text-lg leading-snug line-clamp-3 font-semibold text-foreground"
            title={courseTitle}
          >
            {courseTitle || 'Untitled course'}
          </h1>
        )}
      </div>

      <nav className={cn('pb-4 space-y-1 flex-1 overflow-y-auto', isCollapsed ? 'px-2' : 'px-3')}>
        <NavGroup items={primary} activeKey={activeKey} onNavigate={handleNav} collapsed={isCollapsed} />
        <div className="my-4 border-t border-sidebar-border" />
        <NavGroup items={secondary} activeKey={activeKey} onNavigate={handleNav} collapsed={isCollapsed} />
      </nav>

      <div className={cn('border-t border-sidebar-border p-2', isCollapsed ? 'flex justify-center' : '')}>
        <Hint label={isCollapsed ? 'Expand navigation' : 'Minimize navigation'}>
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={isCollapsed ? 'Expand navigation' : 'Minimize navigation'}
            aria-expanded={!isCollapsed}
            className={cn(
              SIDEBAR_NAV_ITEM_BASE,
              'gap-2 text-sm',
              SIDEBAR_NAV_INACTIVE,
              isCollapsed ? 'p-2 justify-center' : 'w-full px-3 py-2',
            )}
          >
            {isCollapsed ? (
              <PanelLeftOpen className="h-4 w-4 flex-shrink-0" />
            ) : (
              <PanelLeftClose className="h-4 w-4 flex-shrink-0" />
            )}
            {/* The expanded rail had a bare icon here with no word next to it,
                which is the one control in this menu that isn't self-explanatory. */}
            {!isCollapsed && <span className="truncate">Collapse menu</span>}
          </button>
        </Hint>
      </div>
    </>
  );

  return (
    <div className="fixed inset-0 flex font-sans bg-background text-foreground">
      {/* Desktop left rail */}
      <aside
        data-onboarding="builder-nav"
        className={cn(
          'hidden lg:flex flex-shrink-0 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-[width] duration-200',
          collapsed ? 'w-16' : 'w-64',
        )}
      >
        {renderSidebarBody(collapsed)}
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
            {renderSidebarBody(false)}
          </aside>
        </div>
      )}

      {/* Main area */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 px-4 md:px-8 flex items-center gap-3 bg-card flex-shrink-0 border-b border-border">
          <Hint label="Open course navigation">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="lg:hidden p-2 -ml-2 rounded-md hover:bg-muted text-foreground"
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
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-xs md:text-sm font-semibold border border-border hover:bg-muted transition-colors"
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
  collapsed = false,
}: {
  items: { key: BuilderNavKey; label: string; icon: typeof LayoutGrid; comingSoon?: boolean }[];
  activeKey: BuilderNavKey;
  onNavigate: (key: BuilderNavKey) => void;
  collapsed?: boolean;
}) {
  return (
    <div className="space-y-0.5">
      {items.map(({ key, label, icon: Icon, comingSoon }) => {
        const active = key === activeKey;
        const button = (
          <button
            key={key}
            type="button"
            onClick={() => onNavigate(key)}
            title={collapsed ? label : undefined}
            aria-label={collapsed ? label : undefined}
            className={cn(
              SIDEBAR_NAV_ITEM_BASE,
              'group w-full text-sm text-left',
              collapsed ? 'justify-center px-2 py-2' : 'gap-3 px-3 py-2',
              active ? SIDEBAR_NAV_ACTIVE : SIDEBAR_NAV_INACTIVE,
            )}
          >
            <Icon
              className={cn(
                'h-4 w-4 flex-shrink-0',
                sidebarNavIconClass(active),
                !active && 'group-hover:text-sidebar-accent',
              )}
            />
            {!collapsed && <span className="truncate">{label}</span>}
            {!collapsed && comingSoon && (
              <Badge
                variant="outline"
                className="ml-auto flex-shrink-0 border-current text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0 text-inherit bg-transparent opacity-80"
              >
                Coming soon
              </Badge>
            )}
          </button>
        );
        return button;
      })}
    </div>
  );
}

export default TeachableShell;
