// ABOUTME: Course-specific sidebar navigation component for LMS-style course interface
// ABOUTME: Provides navigation within a specific course context with sections like Home, Modules, Announcements, etc.

import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import {
  Home,
  BookOpen,
  MessageCircle,
  Calendar,
  MessageSquare,
  FileText,
  BarChart3,
  Users,
  Settings,
  ChevronLeft,
  User,
  TrendingUp,
  GraduationCap,
  ClipboardCheck,
  Database,
  Lock
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useCourseData } from '@/hooks/useCourseData';
import { useAuth } from '@/contexts/AuthContext';
import { useCoursePermissions } from '@/hooks/useCoursePermissions';
import { usePageVisibility } from '@/contexts/PageVisibilityContext';
import { SIDEBAR_NAV_INACTIVE, sidebarNavIconClass } from '@/lib/sidebarNav';

const courseNavItems = [
  { title: 'Course Home', url: '', icon: Home },
  { title: 'Modules', url: '/modules', icon: BookOpen },
  { title: 'Announcements', url: '/announcements', icon: MessageCircle },
  { title: 'Assignments', url: '/assignments', icon: FileText },
  { title: 'Grades', url: '/grades', icon: BarChart3, studentTitle: 'My Grades' },
  { title: 'Progress', url: '/progress', icon: TrendingUp, studentOnly: true },
  { title: 'Gradebook', url: '/gradebook', icon: GraduationCap, instructorOnly: true },
  { title: 'Rubrics', url: '/rubrics', icon: ClipboardCheck, instructorOnly: true },
  { title: 'Question Banks', url: '/question-banks', icon: Database, instructorOnly: true },
  { title: 'Calendar', url: '/calendar', icon: Calendar },
  { title: 'Messages', url: '/messages', icon: MessageSquare, governedBy: '/messages' },
  { title: 'People', url: '/people', icon: Users },
];

export function CourseSidebar() {
  const { open: desktopOpen, isMobile } = useSidebar();
  // On mobile the rail renders inside a Sheet at full drawer width, and that Sheet
  // is driven by `openMobile` — not by `open`, which only tracks the desktop
  // collapse cookie. Reading `open` there gave a full-width drawer of bare icons
  // with every label suppressed. Same reasoning, same line, as AppSidebar.
  const open = isMobile ? true : desktopOpen;
  const location = useLocation();
  const { courseId } = useParams();
  const { course, isLoading } = useCourseData(courseId);
  const { user } = useAuth();
  const { isInstructor } = useCoursePermissions(courseId);
  // VisibilityGate resolves /courses/:id/messages to the '/courses' manifest entry, so
  // switching Messages off never reached this rail. The toggle governs the feature, not
  // one URL — a link that survives it is an invitation to a page the admin closed.
  const { isPageVisible } = usePageVisibility();
  
  const currentPath = location.pathname;
  const basePath = `/courses/${courseId}`;
  
  const isActive = (itemUrl: string) => {
    const fullPath = `${basePath}${itemUrl}`;
    return currentPath === fullPath || (itemUrl === '' && currentPath === basePath);
  };

  // Active styling comes from SidebarMenuButton's `isActive` (the same
  // `--sidebar-accent` pill the main site nav uses); only the resting state
  // needs stating here.
  const getNavClassName = (itemUrl: string) =>
    isActive(itemUrl) ? 'transition-colors duration-200' : `transition-colors duration-200 ${SIDEBAR_NAV_INACTIVE}`;

  // Filter nav items based on user role
  const filteredNavItems = courseNavItems.filter(item => {
    if (item.instructorOnly && !isInstructor) return false;
    if (item.studentOnly && isInstructor) return false;
    if ('governedBy' in item && !isPageVisible(item.governedBy as string)) return false;
    return true;
  });

  if (isLoading) {
    return (
      <Sidebar className="border-r border-sidebar-border text-sidebar-foreground" collapsible="icon">
        <SidebarContent>
          <div className="animate-pulse p-4">
            <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
            <div className="h-3 bg-muted rounded w-1/2"></div>
          </div>
        </SidebarContent>
      </Sidebar>
    );
  }

  return (
    /* Widths are the primitive's job: it already renders `--sidebar-width` when
       expanded and `--sidebar-width-icon` under `collapsible="icon"`. The old
       hand-set w-14/w-64 pair overrode the collapsed width and never reached the
       mobile Sheet at all. */
    <Sidebar className="border-r border-sidebar-border text-sidebar-foreground" collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className={open ? 'p-4' : 'p-2'}>
          <Button
            variant="ghost"
            size="sm"
            asChild
            className={`mb-4 ${SIDEBAR_NAV_INACTIVE} ${open ? 'w-full justify-start' : 'w-8 h-8 p-0 justify-center mx-auto'}`}
          >
            <Link to="/enrolled-courses" aria-label={open ? undefined : 'Back to Courses'}>
              <ChevronLeft className={`h-4 w-4 ${open ? 'mr-2' : ''}`} />
              {open && 'Back to Courses'}
            </Link>
          </Button>
          
          {open && course && (
            <div>
              <h2 className="font-semibold text-lg line-clamp-2 mb-1">
                {course.title}
              </h2>
              <p className="text-sm text-muted-foreground">
                {course.category} • {course.level}
              </p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredNavItems.map((item) => {
                const label = (item.studentTitle && !isInstructor) ? item.studentTitle : item.title;
                return (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={label}
                    className={`${getNavClassName(item.url)} group`}
                  >
                    <Link
                      to={`${basePath}${item.url}`}
                      // Collapsed, the label is gone and the link is a bare icon —
                      // without this it reaches assistive tech with no name at all.
                      aria-label={open ? undefined : label}
                    >
                      <item.icon
                        className={`h-4 w-4 flex-shrink-0 ${sidebarNavIconClass(isActive(item.url))} ${
                          !isActive(item.url) ? 'group-hover:text-sidebar-accent' : ''
                        }`}
                      />
                      {open && (
                        <>
                          <span className="flex-1 truncate">{label}</span>
                          {item.instructorOnly && (
                            <Lock className="h-3 w-3 ml-1 text-muted-foreground/60 flex-shrink-0" />
                          )}
                        </>
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {open && course?.instructor && (
          <SidebarGroup>
            <SidebarGroupLabel>Instructor</SidebarGroupLabel>
            <SidebarGroupContent>
              <div className="px-3 py-2">
                <div className="flex items-center space-x-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={course.instructor.avatar} />
                    <AvatarFallback>
                      {course.instructor.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-medium truncate">
                      {course.instructor.name}
                    </p>
                  </div>
                </div>
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Home" className={`group transition-colors duration-200 ${SIDEBAR_NAV_INACTIVE}`}>
              <Link to="/dashboard" aria-label={open ? undefined : 'Home'}>
                <Home className="h-4 w-4 flex-shrink-0 text-muted-foreground group-hover:text-sidebar-accent" />
                {open && <span className="truncate">Home</span>}
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}