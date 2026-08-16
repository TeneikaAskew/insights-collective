// ABOUTME: Unified admin shell (Ledger concept): a light section rail on the
// ABOUTME: Soft Studio wash with every admin tool as a nested route. The admin
// ABOUTME: guard is applied once where this layout is routed, not per page.

import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  CalendarDays,
  Newspaper,
  ClipboardList,
  Activity,
  Eye,
  Database,
  Mail,
} from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

interface AdminSection {
  title: string;
  url: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
  /** Instructors (non-admins) only see sections marked true */
  instructor?: boolean;
  /** Extra path prefixes (legacy URLs) that should light this link up */
  activePrefixes?: string[];
}

const SECTIONS: AdminSection[] = [
  { title: 'Dashboard', url: '/admin', icon: LayoutDashboard, end: true },
  { title: 'Users', url: '/admin/users', icon: Users },
  { title: 'Courses', url: '/admin/courses', icon: GraduationCap },
  { title: 'Events', url: '/admin/events', icon: CalendarDays },
  { title: 'Blog', url: '/admin/blog', icon: Newspaper, instructor: true },
  {
    title: 'Forms',
    url: '/admin/forms',
    icon: ClipboardList,
    activePrefixes: ['/admin/form-management', '/admin/unified-form-management'],
  },
  { title: 'Activity', url: '/admin/activity', icon: Activity },
];

const PLATFORM_SECTIONS: AdminSection[] = [
  { title: 'Page visibility', url: '/admin/page-visibility', icon: Eye },
  { title: 'Email log', url: '/admin/email-log', icon: Mail },
  ...(import.meta.env.DEV
    ? [{ title: 'Debug tools', url: '/admin/debug/storage', icon: Database }]
    : []),
];

function RailLink({ section, className }: { section: AdminSection; className?: string }) {
  const location = useLocation();
  const prefixActive =
    section.activePrefixes?.some(prefix => location.pathname.startsWith(prefix)) ?? false;

  return (
    <NavLink
      to={section.url}
      end={section.end}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-2.5 rounded-full px-3.5 py-2 text-sm transition-colors',
          isActive || prefixActive
            ? 'bg-ss-lav-chip font-semibold text-ss-lav-deep'
            : 'text-foreground/80 hover:bg-foreground/5 hover:text-foreground',
          className,
        )
      }
    >
      <section.icon className="h-4 w-4 shrink-0 opacity-70" />
      <span className="truncate">{section.title}</span>
    </NavLink>
  );
}

/**
 * Renders `children` when given (used by the blog route, which carries its
 * own instructor-friendly guard), otherwise the nested route via <Outlet/>.
 */
export default function AdminLayout({ children }: { children?: React.ReactNode }) {
  const { isAdmin } = useAuth();

  const sections = isAdmin ? SECTIONS : SECTIONS.filter(s => s.instructor);
  const platformSections = isAdmin ? PLATFORM_SECTIONS : [];

  return (
    <AppLayout fullWidth>
      <div className="ss-wash flex min-h-full w-full">
        <aside className="hidden w-56 shrink-0 border-r border-border px-3 py-6 md:block">
          <div className="px-3.5 pb-4">
            <p className="text-sm font-semibold">Admin</p>
            <p className="ss-serif text-xs text-ss-peach-deep">every tool, one shell</p>
          </div>
          <nav className="space-y-0.5">
            {sections.map(section => (
              <RailLink key={section.url} section={section} />
            ))}
            {platformSections.length > 0 && (
              <>
                <p className="px-3.5 pb-1 pt-5 text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                  Platform
                </p>
                {platformSections.map(section => (
                  <RailLink key={section.url} section={section} />
                ))}
              </>
            )}
          </nav>
        </aside>
        <div className="min-w-0 flex-1">
          {/* Mobile: the rail is hidden, so every section gets a scrollable
              pill above the content instead. */}
          <nav
            className="flex gap-2 overflow-x-auto whitespace-nowrap px-4 pt-4 pb-1 md:hidden"
            aria-label="Admin sections"
          >
            {[...sections, ...platformSections].map(section => (
              <RailLink key={section.url} section={section} className="shrink-0" />
            ))}
          </nav>
          {/* div, not <main> — AppLayout already provides the main landmark */}
          <div className="px-4 py-8 sm:px-6 lg:px-8" data-testid="admin-shell-content">
            <div className="mx-auto w-full max-w-6xl">
              {children ?? <Outlet />}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
