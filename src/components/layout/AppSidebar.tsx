import React from 'react';
import { BookOpen, Home, UserCircle, GraduationCap, Calendar, Bell, FileText, Briefcase, Award, Bot, MessageSquare, FileUp, FileCheck, LayoutDashboard, Newspaper, Lightbulb, Twitter } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useLocation, Link } from 'react-router-dom';
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, SidebarRail, useSidebar } from '@/components/ui/sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { usePageVisibility } from '@/contexts/PageVisibilityContext';
import { motion } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { SIDEBAR_NAV_INACTIVE } from '@/lib/sidebarNav';

const AppSidebar = () => {
  const location = useLocation();
  const {
    user,
    isAuthenticated
  } = useAuth();
  const { isPageVisible, isLoading: pageVisibilityLoading } = usePageVisibility();
  const { open: desktopOpen, isMobile } = useSidebar();
  // On mobile the sidebar renders inside a Sheet — when the sheet is on-screen,
  // labels should always render regardless of the desktop `open` cookie state.
  const open = isMobile ? true : desktopOpen;

  /**
   * One shape for every nav entry.
   *
   * Without it the arrays infer a union of per-entry object literals, so a flag
   * present on only some entries — `nested` here, as `manifestPath` already had
   * to be — is not readable off the mapped item without a cast.
   */
  interface SidebarNavItem {
    title: string;
    url: string;
    icon: LucideIcon;
    active: boolean;
    /** Link differs from the visibility-manifest entry that governs it. */
    manifestPath?: string;
    /** Renders a "New" badge and an accent outline. */
    highlight?: boolean;
    /** Indented as a child of the entry above it. */
    nested?: boolean;
  }

  // Define public menu items with corrected routes
  const publicMenuItems: SidebarNavItem[] = [{
    title: "Dashboard",
    url: "/dashboard",
    icon: Home,
    active: location.pathname === '/dashboard'
  }, {
    title: "Resources",
    url: "/resources",
    icon: FileText,
    active: location.pathname === '/resources'
  },
  // The two social archives belong to Resources — they are reading material,
  // not destinations of their own — so they sit directly beneath it and are
  // indented to say so. They used to sit between Messages and Notifications,
  // where nothing connected them to anything around them.
  {
    title: "Teneika's LinkedIn",
    url: "/teneika-linkedin",
    icon: Briefcase,
    active: location.pathname === '/teneika-linkedin',
    nested: true
  }, {
    title: "Teneika's Tweets",
    url: "/teneika-tweets",
    icon: Twitter,
    active: location.pathname === '/teneika-tweets',
    nested: true
  }, {
    title: "Courses",
    url: "/courses",
    icon: BookOpen,
    active: location.pathname.startsWith('/course')
  }, {
    title: "Resume Analyzer",
    url: "/resume",
    icon: FileUp,
    active: location.pathname === '/resume',
    highlight: true
  }, {
    title: "Interview Prep",
    url: "/interview-prep",
    icon: Lightbulb,
    active: location.pathname.startsWith('/interview-prep'),
    highlight: true
  }, {
    title: "Career Pathway",
    url: "/career-pathway",
    icon: Briefcase,
    active: location.pathname === '/career-pathway',
    highlight: true
  }, {
    title: "Portfolio Explorer",
    url: "/portfolio-explorer",
    icon: Award,
    active: location.pathname === '/portfolio-explorer',
    highlight: true
  }, {
    title: "AI & Automation Fellowship",
    url: "/survey",
    icon: FileCheck,
    active: location.pathname === '/survey' || location.pathname === '/survey/confirmation'
  }, {
    title: "Events",
    url: "/events",
    icon: Calendar,
    active: location.pathname === '/events' && !location.pathname.includes('/admin/events')
  }, {
    title: "Assistants",
    url: "/assistants",
    icon: Bot,
    active: location.pathname === '/assistants' || location.pathname.startsWith('/assistant/')
  }, {
    title: "Messages",
    // Messages live in the Dashboard beside the Calendar — same reasoning, same place.
    // The visibility manifest still keys this off /messages, so isPageVisible() below
    // keeps working against the entry admins already know.
    url: "/dashboard?tab=messages",
    manifestPath: "/messages",
    icon: MessageSquare,
    active: location.pathname === '/dashboard' && location.search.includes('tab=messages')
  }, {
    title: "Notifications",
    url: "/notifications",
    icon: Bell,
    active: location.pathname === '/notifications'
  }, {
    title: "Profile",
    url: "/profile",
    icon: UserCircle,
    active: location.pathname === '/profile'
  }];

  // Slim browse list for anonymous visitors — only pages they can meaningfully use before signing up
  const browseMenuItems: SidebarNavItem[] = [{
    title: "Dashboard",
    url: "/dashboard",
    icon: Home,
    active: location.pathname === '/dashboard'
  }, {
    title: "Resources",
    url: "/resources",
    icon: FileText,
    active: location.pathname === '/resources'
  }, {
    title: "Courses",
    url: "/courses",
    icon: BookOpen,
    active: location.pathname.startsWith('/course')
  }, {
    title: "Events",
    url: "/events",
    icon: Calendar,
    active: location.pathname === '/events'
  }, {
    title: "Career Pathway",
    url: "/career-pathway",
    icon: Bot,
    active: location.pathname === '/career-pathway',
    highlight: true
  }, {
    title: "Resume Analyzer",
    url: "/resume",
    icon: FileUp,
    active: location.pathname === '/resume',
    highlight: true
  }];

  // Single entry into the unified admin shell — section navigation lives in
  // the shell's own rail (src/pages/admin/AdminLayout.tsx).
  const adminMenuItems = [{
    title: "Admin",
    url: "/admin",
    icon: LayoutDashboard,
    active: location.pathname.startsWith('/admin')
  }];

  const isAdmin = user?.roles?.includes('admin');
  const isInstructor = user?.roles?.includes('instructor');
  
  // Filter menu items based on page visibility settings.
  // While loading, hide managed items for non-admin users (fail-closed).
  // Admins always see everything.
  const visiblePublicMenuItems = isAdmin
    ? publicMenuItems
    // `manifestPath` exists for items whose link is no longer their manifest entry:
    // Messages is a Dashboard tab now, but admins still toggle it as "/messages".
    // Without this, isPageVisible("/dashboard?tab=messages") misses and the item
    // silently disappears for every non-admin.
    : publicMenuItems.filter(item => isPageVisible(item.manifestPath ?? item.url));
  const visibleAdminMenuItems = isAdmin
    ? adminMenuItems
    : [];

  // Anonymous users get a slim browse list; authenticated users get the full nav
  const menuItems = isAuthenticated ? [...visiblePublicMenuItems] : browseMenuItems;

  const menuItemVariants = {
    hidden: {
      opacity: 0,
      x: -20
    },
    visible: (i: number) => ({
      opacity: 1,
      x: 0,
      transition: {
        delay: i * 0.05,
        duration: 0.3
      }
    })
  };

  return (
    <Sidebar className="border-r border-sidebar-border text-sidebar-foreground" collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-2">
        <div className={`flex items-center ${open ? 'space-x-2' : 'justify-center'} p-2`}>
          <Link to="/" className={`flex items-center ${open ? 'space-x-2' : ''}`}>
            <div className="relative w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-md bg-gradient-to-tr from-ss-lav to-ss-lav-deep">
              <GraduationCap className="h-4 w-4 text-primary-foreground" />
            </div>
            {open && <span className="font-bold text-base">Insights Collective</span>}
          </Link>
        </div>
      </SidebarHeader>
      
      <SidebarContent className="py-2 px-2 group-data-[collapsible=icon]:px-0">
        {isAuthenticated && <div className={`mb-4 ${open ? 'px-2' : 'flex justify-center'}`}>
            <div className={`flex items-center ${open ? 'space-x-2' : 'justify-center'} mb-2`}>
              <Avatar className="border-2 border-ss-lav/30 w-7 h-7 flex-shrink-0">
                <AvatarImage src={user?.avatar} alt="User avatar" />
                <AvatarFallback className="bg-ss-lav-chip text-ss-lav-deep text-xs">
                  {user?.email?.charAt(0).toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              {open && <div>
                <p className="font-medium text-xs truncate max-w-[140px]">
                  {user?.name || user?.email?.split('@')[0] || 'User'}
                </p>
                <p className="text-[10px] text-muted-foreground">{isAdmin ? 'Administrator' : isInstructor ? 'Instructor' : 'Member'}</p>
              </div>}
            </div>
          </div>}

        {!isAuthenticated && open && (
          <div className="mb-4 px-2 py-3 bg-ss-lav-chip rounded-lg border border-ss-lav/30">
            <p className="text-[10px] text-muted-foreground mb-2 font-medium">Join to unlock all features</p>
            <div className="space-y-1.5">
              <Button asChild className="w-full h-8 text-xs bg-primary hover:bg-primary/90 text-primary-foreground">
                <Link to="/register">Create Free Account</Link>
              </Button>
              <Button asChild variant="ghost" className="w-full h-8 text-xs text-muted-foreground">
                <Link to="/login">Sign In</Link>
              </Button>
            </div>
          </div>
        )}

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item, index) => (
                  <motion.div key={item.title} custom={index} initial="hidden" animate="visible" variants={menuItemVariants} className={open ? '' : 'flex justify-center'}>
                    <SidebarMenuItem className={open ? '' : 'w-8'}>
                      <SidebarMenuButton asChild isActive={item.active} className={`transition-all duration-200 ${item.active ? 'font-medium' : SIDEBAR_NAV_INACTIVE}`}>
                        {/* `nested` indents a child of the entry above it. Only
                            when the rail is expanded: collapsed, the rail is a
                            column of centred icons and an indent there would
                            just knock one out of alignment with no label
                            present to explain why. */}
                        <Link to={item.url} className={`flex items-center rounded-md py-1.5 ${open ? 'space-x-2 px-2' : 'justify-center w-8 h-8 px-0 mx-auto'} ${item.nested && open ? 'ml-4 border-l border-sidebar-border pl-3' : ''} ${item.highlight && open && !item.active ? 'bg-sidebar-accent/10 border border-sidebar-accent/30' : ''}`}>


                          <item.icon className={`h-3.5 w-3.5 flex-shrink-0 ${item.active ? 'text-sidebar-accent-foreground' : 'text-muted-foreground'}`} />
                          {open && <span className="text-xs truncate">{item.title}</span>}
                          {open && item.highlight && !item.active && (
                            <Badge className="ml-auto h-4 text-[10px] bg-sidebar-accent/20 text-sidebar-accent hover:bg-sidebar-accent/30">
                              New
                            </Badge>
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </motion.div>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        
        {isAuthenticated && (isAdmin || isInstructor) && <SidebarGroup className="mt-4">
            {open && <SidebarGroupLabel className="text-muted-foreground font-medium px-2 py-1 text-[10px] uppercase tracking-wider">
              {isAdmin ? 'Administration' : 'Instructor Tools'}
            </SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {isAdmin && visibleAdminMenuItems.map(item => <SidebarMenuItem key={item.title} className={open ? '' : 'flex justify-center'}>
                    <SidebarMenuButton asChild isActive={item.active} className={`transition-all duration-200 ${item.active ? 'font-medium' : SIDEBAR_NAV_INACTIVE}`}>
                      <Link to={item.url} className={`flex items-center rounded-md py-1.5 ${open ? 'space-x-2 px-2' : 'justify-center w-8 h-8 px-0 mx-auto'}`}>
                        <item.icon className={`h-3.5 w-3.5 flex-shrink-0 ${item.active ? 'text-sidebar-accent-foreground' : 'text-muted-foreground'}`} />
                        {open && <span className="text-xs truncate">{item.title}</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>)}
                
                {isInstructor && !isAdmin && <SidebarMenuItem className={open ? '' : 'flex justify-center'}>
                    <SidebarMenuButton asChild className={SIDEBAR_NAV_INACTIVE}>
                      <Link to="/course-management" className={`flex items-center rounded-md py-1.5 ${open ? 'space-x-2 px-2' : 'justify-center w-8 h-8 px-0 mx-auto'}`}>
                        <BookOpen className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                        {open && <span className="text-xs truncate">My Courses</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>}

                {/* Instructors author blog posts too — RLS grants them CRUD on
                    their own posts, so surface the entry rather than leaving the
                    capability unreachable. Admins already get it above. */}
                {isInstructor && !isAdmin && <SidebarMenuItem className={open ? '' : 'flex justify-center'}>
                    <SidebarMenuButton asChild isActive={location.pathname.startsWith('/admin/blog')} className={location.pathname.startsWith('/admin/blog') ? '' : SIDEBAR_NAV_INACTIVE}>
                      <Link to="/admin/blog" className={`flex items-center rounded-md py-1.5 ${open ? 'space-x-2 px-2' : 'justify-center w-8 h-8 px-0 mx-auto'}`}>
                        <Newspaper className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                        {open && <span className="text-xs truncate">Manage Blog</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>}

              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>}
      </SidebarContent>
      
      <SidebarFooter className="border-t border-sidebar-border mt-auto p-3">
        {!isAuthenticated && open ? <div className="space-y-2 px-2">
            <Button variant="outline" asChild className="w-full justify-start text-xs h-8">
              <Link to="/login">Sign In</Link>
            </Button>
            <Button asChild className="w-full justify-start bg-primary hover:bg-primary/90 text-primary-foreground text-xs h-8">
              <Link to="/register">Create Account</Link>
            </Button>
          </div> : open ? <div className="text-[10px] text-muted-foreground px-2">
            <p>Insights Collective v1.0</p>
          </div> : null}
      </SidebarFooter>
      
      <SidebarRail />
    </Sidebar>
  );
};

export default AppSidebar;
