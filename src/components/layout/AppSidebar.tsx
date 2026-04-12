import { BookOpen, Home, BarChart2, UserCircle, GraduationCap, Settings, Calendar, Bell, Users, FileText, Briefcase, Award, Bot, MessageSquare, FileUp, Eye, Compass, FileCheck, FormInput, Newspaper, Bug, Lightbulb, Twitter } from 'lucide-react';
import { useLocation, Link } from 'react-router-dom';
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarTrigger, SidebarFooter, SidebarRail } from '@/components/ui/sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { usePageVisibility } from '@/contexts/PageVisibilityContext';
import { motion } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const AppSidebar = () => {
  const location = useLocation();
  const {
    user,
    isAuthenticated
  } = useAuth();
  const { isPageVisible, isLoading: pageVisibilityLoading } = usePageVisibility();

  // Define public menu items with corrected routes
  const publicMenuItems = [{
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
    title: "Career Agent",
    url: "/career-agent",
    icon: Bot,
    active: location.pathname === '/career-agent',
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
    title: "Courses",
    url: "/courses",
    icon: BookOpen,
    active: location.pathname.startsWith('/course')
  }, {
    title: "Data Blueprint",
    url: "/data-blueprint-series",
    icon: FileText,
    active: location.pathname === '/data-blueprint-series'
  }, {
    title: "AI & Automation Fellowship",
    url: "/survey",
    icon: FileCheck,
    active: location.pathname === '/survey' || location.pathname === '/survey/confirmation'
  }, {
    title: "Forums",
    url: "/forums",
    icon: MessageSquare,
    active: location.pathname === '/forums' || location.pathname.includes('/forums/') || location.pathname.includes('/thread/')
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
    url: "/messages",
    icon: MessageSquare,
    active: location.pathname.startsWith('/messages')
  }, {
    title: "Teneika's LinkedIn",
    url: "/teneika-linkedin",
    icon: Briefcase,
    active: location.pathname === '/teneika-linkedin'
  }, {
    title: "Teneika's Tweets",
    url: "/teneika-tweets",
    icon: Twitter,
    active: location.pathname === '/teneika-tweets'
  }, {
    title: "Calendar",
    url: "/calendar",
    icon: Calendar,
    active: location.pathname === '/calendar'
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

  // Define admin menu items - removed Manage Resources
  const adminMenuItems = [{
    title: "Admin Dashboard",
    url: "/admin",
    icon: BarChart2,
    active: location.pathname === '/admin' || location.pathname === '/admin/activity'
  }, {
    title: "Manage Courses",
    url: "/admin/courses",
    icon: GraduationCap,
    active: location.pathname === '/admin/courses'
  }, {
    title: "Manage Users",
    url: "/admin/users",
    icon: Users,
    active: location.pathname === '/admin/users'
  }, {
    title: "Manage Forms",
    url: "/admin/forms",
    icon: FormInput,
    active: location.pathname === '/admin/forms'
  }, {
    title: "Manage Blog",
    url: "/admin/blog",
    icon: Newspaper,
    active: location.pathname.startsWith('/admin/blog')
  }, {
    title: "Manage Events",
    url: "/admin/events",
    icon: Calendar,
    active: location.pathname === '/admin/events'
  }, {
    title: "Page Visibility",
    url: "/admin/page-visibility",
    icon: Eye,
    active: location.pathname === '/admin/page-visibility'
  }, {
    title: "Debug Tools",
    url: "/admin/localstorage-debug",
    icon: Bug,
    active: location.pathname.includes('/admin/debug') || location.pathname.includes('/admin/localstorage')
  }];

  const isAdmin = user?.roles?.includes('admin');
  const isInstructor = user?.roles?.includes('instructor');
  
  // Filter menu items based on page visibility settings
  // For admin users, show all items immediately. For others, wait for data to load.
  const visiblePublicMenuItems = isAdmin || !pageVisibilityLoading 
    ? publicMenuItems.filter(item => isPageVisible(item.url))
    : [];
  const visibleAdminMenuItems = isAdmin || !pageVisibilityLoading
    ? adminMenuItems.filter(item => isPageVisible(item.url))
    : [];
  
  const menuItems = [...visiblePublicMenuItems];

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
    <Sidebar className="border-r border-gray-200 dark:border-gray-800 text-gray-800 dark:text-gray-200">
      <SidebarHeader className="border-b border-gray-200 dark:border-gray-800 px-2 bg-gray-100">
        <div className="flex items-center space-x-2 p-2">
          <Link to="/" className="flex items-center space-x-2">
            <div className="relative w-7 h-7 flex items-center justify-center rounded-md bg-gradient-to-tr from-[#9b87f5] to-[#7E69AB]">
              <GraduationCap className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-base">Insights Collective</span>
          </Link>
        </div>
      </SidebarHeader>
      
      <SidebarContent className="py-2 px-2 bg-gray-50 dark:bg-gray-900">
        {isAuthenticated && <div className="mb-4 px-2">
            <div className="flex items-center space-x-2 mb-2">
              <Avatar className="border-2 border-[#9b87f5]/20 w-7 h-7">
                <AvatarImage src={user?.avatar} alt="User avatar" />
                <AvatarFallback className="bg-[#9b87f5]/10 text-[#9b87f5] text-xs">
                  {user?.email?.charAt(0).toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium text-xs truncate max-w-[140px]">
                  {user?.name || user?.email?.split('@')[0] || 'User'}
                </p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400">{isAdmin ? 'Administrator' : isInstructor ? 'Instructor' : 'Member'}</p>
              </div>
            </div>
          </div>}
      
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item, index) => <motion.div key={item.title} custom={index} initial="hidden" animate="visible" variants={menuItemVariants}>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={item.active} className={`transition-all duration-200 ${item.active ? 'bg-[#9b87f5]/10 text-[#9b87f5] font-medium border-r-2 border-[#9b87f5]' : 'text-gray-700 dark:text-gray-300 hover:text-[#9b87f5] hover:bg-[#9b87f5]/5'}`}>
                      <Link to={item.url} className={`flex items-center space-x-2 rounded-md px-2 py-1.5 ${item.highlight ? 'bg-[#9b87f5]/5 border border-[#9b87f5]/20' : ''}`}>
                        <item.icon className={`h-3.5 w-3.5 flex-shrink-0 ${item.active ? 'text-[#9b87f5]' : 'text-gray-500 dark:text-gray-400'}`} />
                        <span className="text-xs truncate">{item.title}</span>
                        {item.highlight && !item.active && (
                          <Badge className="ml-auto h-4 text-[10px] bg-[#9b87f5]/20 text-[#9b87f5] hover:bg-[#9b87f5]/30">
                            New
                          </Badge>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </motion.div>)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        
        {isAuthenticated && (isAdmin || isInstructor) && <SidebarGroup className="mt-4">
            <SidebarGroupLabel className="text-gray-500 dark:text-gray-400 font-medium px-2 py-1 text-[10px] uppercase tracking-wider">
              {isAdmin ? 'Administration' : 'Instructor Tools'}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {isAdmin && visibleAdminMenuItems.map(item => <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={item.active} className={`transition-all duration-200 ${item.active ? 'bg-[#9b87f5]/10 text-[#9b87f5] font-medium border-r-2 border-[#9b87f5]' : 'text-gray-700 dark:text-gray-400 hover:text-[#9b87f5] hover:bg-[#9b87f5]/5'}`}>
                      <Link to={item.url} className="flex items-center space-x-2 rounded-md px-2 py-1.5">
                        <item.icon className={`h-3.5 w-3.5 flex-shrink-0 ${item.active ? 'text-[#9b87f5]' : 'text-gray-500'}`} />
                        <span className="text-xs truncate">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>)}
                
                {isInstructor && !isAdmin && <SidebarMenuItem>
                    <SidebarMenuButton asChild className="text-gray-700 dark:text-gray-400 hover:text-[#9b87f5] hover:bg-[#9b87f5]/5">
                      <Link to="/course-management" className="flex items-center space-x-2 rounded-md px-2 py-1.5">
                        <BookOpen className="h-3.5 w-3.5 flex-shrink-0 text-gray-500" />
                        <span className="text-xs truncate">My Courses</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>}
      </SidebarContent>
      
      <SidebarFooter className="border-t border-gray-200 dark:border-gray-800 mt-auto p-3 bg-gray-50 dark:bg-gray-900">
        {!isAuthenticated ? <div className="space-y-2 px-2">
            <Button variant="outline" asChild className="w-full justify-start text-xs h-8">
              <Link to="/login">Sign In</Link>
            </Button>
            <Button asChild className="w-full justify-start bg-[#9b87f5] hover:bg-[#8B5CF6] text-white text-xs h-8">
              <Link to="/register">Create Account</Link>
            </Button>
          </div> : <div className="text-[10px] text-gray-500 dark:text-gray-400 px-2">
            <p>Insights Collective v1.0</p>
          </div>}
      </SidebarFooter>
      
      <SidebarRail />
    </Sidebar>
  );
};

export default AppSidebar;
