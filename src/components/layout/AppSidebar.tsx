
import { BookOpen, Home, BarChart2, UserCircle, GraduationCap, Settings, Calendar, Bell, Users, FileText, Briefcase, Award, ChevronRight, Bot, MessageSquare, FileUp, Eye, Compass, FileCheck, FormInput, Newspaper, Bug, Lightbulb } from 'lucide-react';
import { useLocation, Link } from 'react-router-dom';
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarTrigger, SidebarFooter, SidebarRail } from '@/components/ui/sidebar';
import { useAuth } from '@/contexts/AuthContext';
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

  // Define public menu items with corrected routes
  const publicMenuItems = [{
    title: "Dashboard",
    url: "/dashboard",
    icon: Home,
    active: location.pathname === '/dashboard',
    group: "navigation"
  }, {
    title: "Resources",
    url: "/resources",
    icon: FileText,
    active: location.pathname === '/resources',
    group: "learning"
  }, {
    title: "Resume Analyzer",
    url: "/resume",
    icon: FileUp,
    active: location.pathname === '/resume',
    highlight: true,
    group: "career-tools"
  }, {
    title: "Interview Prep",
    url: "/interview-prep",
    icon: Lightbulb,
    active: location.pathname.startsWith('/interview-prep'),
    highlight: true,
    group: "career-tools"
  }, {
    title: "Career Agent",
    url: "/career-agent",
    icon: Bot,
    active: location.pathname === '/career-agent',
    group: "career-tools"
  }, {
    title: "Career Pathway",
    url: "/career-pathway",
    icon: Briefcase,
    active: location.pathname === '/career-pathway',
    group: "learning"
  }, {
    title: "Portfolio Explorer",
    url: "/portfolio-explorer",
    icon: Award,
    active: location.pathname === '/portfolio-explorer',
    highlight: true,
    group: "learning"
  }, {
    title: "Courses",
    url: "/courses",
    icon: BookOpen,
    active: location.pathname.startsWith('/course') && !location.pathname.includes('/forums'),
    group: "learning"
  }, {
    title: "Data Blueprint",
    url: "/data-blueprint",
    icon: FileText,
    active: location.pathname === '/data-blueprint',
    group: "learning"
  }, {
    title: "AI & Automation Fellowship",
    url: "/survey",
    icon: FileCheck,
    active: location.pathname === '/survey' || location.pathname === '/survey/confirmation',
    group: "learning"
  }, {
    title: "Forums",
    url: "/forums",
    icon: MessageSquare,
    active: location.pathname === '/forums' || location.pathname.includes('/forums/') || location.pathname.includes('/thread/'),
    group: "community"
  }, {
    title: "Events",
    url: "/events",
    icon: Calendar,
    active: location.pathname === '/events' && !location.pathname.includes('/admin/events'),
    group: "community"
  }, {
    title: "Assistants",
    url: "/assistants",
    icon: Bot,
    active: location.pathname === '/assistants' || location.pathname.startsWith('/assistant/'),
    group: "community"
  }, {
    title: "Messages",
    url: "/messages",
    icon: MessageSquare,
    active: location.pathname.startsWith('/messages'),
    group: "community"
  }, {
    title: "Blog",
    url: "/blog",
    icon: Newspaper,
    active: location.pathname.startsWith('/blog'),
    group: "community"
  }, {
    title: "Calendar",
    url: "/calendar",
    icon: Calendar,
    active: location.pathname === '/calendar',
    group: "personal"
  }, {
    title: "Notifications",
    url: "/notifications",
    icon: Bell,
    active: location.pathname === '/notifications',
    group: "personal"
  }, {
    title: "Profile",
    url: "/profile",
    icon: UserCircle,
    active: location.pathname === '/profile',
    group: "personal"
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
    url: "/admin/blog-posts",
    icon: Newspaper,
    active: location.pathname === '/admin/blog-posts'
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

  // Group menu items by category for tour targeting
  const careerToolsItems = publicMenuItems.filter(item => item.group === 'career-tools');
  const learningItems = publicMenuItems.filter(item => item.group === 'learning');
  const communityItems = publicMenuItems.filter(item => item.group === 'community');
  const personalItems = publicMenuItems.filter(item => item.group === 'personal');
  const navigationItems = publicMenuItems.filter(item => item.group === 'navigation');

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
    <Sidebar className="border-r border-gray-200 dark:border-gray-800 text-gray-800 dark:text-gray-200" data-tour-group="navigation">
      <SidebarHeader className="border-b border-gray-200 dark:border-gray-800 px-2 bg-gray-100">
        <div className="flex items-center space-x-2 p-2">
          <Link to="/" className="flex items-center space-x-2">
            <div className="relative w-7 h-7 flex items-center justify-center rounded-md bg-gradient-to-tr from-[#9b87f5] to-[#7E69AB]">
              <GraduationCap className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-base">Insights Collective</span>
          </Link>
        </div>
        <SidebarTrigger className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 absolute right-2 top-2" />
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
              {/* Navigation Items */}
              <div data-tour-group="navigation">
                {navigationItems.map((item, index) => (
                  <motion.div key={item.title} custom={index} initial="hidden" animate="visible" variants={menuItemVariants}>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={item.active} className={`transition-all duration-200 ${item.active ? 'bg-[#9b87f5]/10 text-[#9b87f5] font-medium' : 'text-gray-700 dark:text-gray-300 hover:text-[#9b87f5] hover:bg-[#9b87f5]/5'}`}>
                        <Link to={item.url} className={`flex items-center space-x-2 rounded-md px-2 py-1.5 ${item.highlight ? 'bg-[#9b87f5]/5 border border-[#9b87f5]/20' : ''}`}>
                          <item.icon className={`h-3.5 w-3.5 flex-shrink-0 ${item.active ? 'text-[#9b87f5]' : 'text-gray-500 dark:text-gray-400'}`} />
                          <span className="text-xs truncate">{item.title}</span>
                          {item.highlight && !item.active && (
                            <Badge className="ml-auto h-4 text-[10px] bg-[#9b87f5]/20 text-[#9b87f5] hover:bg-[#9b87f5]/30">
                              New
                            </Badge>
                          )}
                          {item.active && (
                            <div className="ml-auto">
                              <ChevronRight className="h-3 w-3 text-[#9b87f5]" />
                            </div>
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </motion.div>
                ))}
              </div>

              {/* Career Tools Section */}
              <div data-tour-group="career-tools" className="mt-4">
                <div className="px-2 py-1 text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Career Tools</div>
                {careerToolsItems.map((item, index) => (
                  <motion.div key={item.title} custom={index + navigationItems.length} initial="hidden" animate="visible" variants={menuItemVariants}>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={item.active} className={`transition-all duration-200 ${item.active ? 'bg-[#9b87f5]/10 text-[#9b87f5] font-medium' : 'text-gray-700 dark:text-gray-300 hover:text-[#9b87f5] hover:bg-[#9b87f5]/5'}`}>
                        <Link to={item.url} className={`flex items-center space-x-2 rounded-md px-2 py-1.5 ${item.highlight ? 'bg-[#9b87f5]/5 border border-[#9b87f5]/20' : ''}`}>
                          <item.icon className={`h-3.5 w-3.5 flex-shrink-0 ${item.active ? 'text-[#9b87f5]' : 'text-gray-500 dark:text-gray-400'}`} />
                          <span className="text-xs truncate">{item.title}</span>
                          {item.highlight && !item.active && (
                            <Badge className="ml-auto h-4 text-[10px] bg-[#9b87f5]/20 text-[#9b87f5] hover:bg-[#9b87f5]/30">
                              New
                            </Badge>
                          )}
                          {item.active && (
                            <div className="ml-auto">
                              <ChevronRight className="h-3 w-3 text-[#9b87f5]" />
                            </div>
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </motion.div>
                ))}
              </div>

              {/* Learning Resources Section */}
              <div data-tour-group="learning" className="mt-4">
                <div className="px-2 py-1 text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Learning & Development</div>
                {learningItems.map((item, index) => (
                  <motion.div key={item.title} custom={index + navigationItems.length + careerToolsItems.length} initial="hidden" animate="visible" variants={menuItemVariants}>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={item.active} className={`transition-all duration-200 ${item.active ? 'bg-[#9b87f5]/10 text-[#9b87f5] font-medium' : 'text-gray-700 dark:text-gray-300 hover:text-[#9b87f5] hover:bg-[#9b87f5]/5'}`}>
                        <Link to={item.url} className={`flex items-center space-x-2 rounded-md px-2 py-1.5 ${item.highlight ? 'bg-[#9b87f5]/5 border border-[#9b87f5]/20' : ''}`}>
                          <item.icon className={`h-3.5 w-3.5 flex-shrink-0 ${item.active ? 'text-[#9b87f5]' : 'text-gray-500 dark:text-gray-400'}`} />
                          <span className="text-xs truncate">{item.title}</span>
                          {item.highlight && !item.active && (
                            <Badge className="ml-auto h-4 text-[10px] bg-[#9b87f5]/20 text-[#9b87f5] hover:bg-[#9b87f5]/30">
                              New
                            </Badge>
                          )}
                          {item.active && (
                            <div className="ml-auto">
                              <ChevronRight className="h-3 w-3 text-[#9b87f5]" />
                            </div>
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </motion.div>
                ))}
              </div>

              {/* Community Features Section */}
              <div data-tour-group="community" className="mt-4">
                <div className="px-2 py-1 text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Community & Networking</div>
                {communityItems.map((item, index) => (
                  <motion.div key={item.title} custom={index + navigationItems.length + careerToolsItems.length + learningItems.length} initial="hidden" animate="visible" variants={menuItemVariants}>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={item.active} className={`transition-all duration-200 ${item.active ? 'bg-[#9b87f5]/10 text-[#9b87f5] font-medium' : 'text-gray-700 dark:text-gray-300 hover:text-[#9b87f5] hover:bg-[#9b87f5]/5'}`}>
                        <Link to={item.url} className={`flex items-center space-x-2 rounded-md px-2 py-1.5 ${item.highlight ? 'bg-[#9b87f5]/5 border border-[#9b87f5]/20' : ''}`}>
                          <item.icon className={`h-3.5 w-3.5 flex-shrink-0 ${item.active ? 'text-[#9b87f5]' : 'text-gray-500 dark:text-gray-400'}`} />
                          <span className="text-xs truncate">{item.title}</span>
                          {item.highlight && !item.active && (
                            <Badge className="ml-auto h-4 text-[10px] bg-[#9b87f5]/20 text-[#9b87f5] hover:bg-[#9b87f5]/30">
                              New
                            </Badge>
                          )}
                          {item.active && (
                            <div className="ml-auto">
                              <ChevronRight className="h-3 w-3 text-[#9b87f5]" />
                            </div>
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </motion.div>
                ))}
              </div>

              {/* Personal Management Section */}
              <div data-tour-group="personal" className="mt-4">
                <div className="px-2 py-1 text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Personal Management</div>
                {personalItems.map((item, index) => (
                  <motion.div key={item.title} custom={index + navigationItems.length + careerToolsItems.length + learningItems.length + communityItems.length} initial="hidden" animate="visible" variants={menuItemVariants}>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={item.active} className={`transition-all duration-200 ${item.active ? 'bg-[#9b87f5]/10 text-[#9b87f5] font-medium' : 'text-gray-700 dark:text-gray-300 hover:text-[#9b87f5] hover:bg-[#9b87f5]/5'}`}>
                        <Link to={item.url} className={`flex items-center space-x-2 rounded-md px-2 py-1.5 ${item.highlight ? 'bg-[#9b87f5]/5 border border-[#9b87f5]/20' : ''}`}>
                          <item.icon className={`h-3.5 w-3.5 flex-shrink-0 ${item.active ? 'text-[#9b87f5]' : 'text-gray-500 dark:text-gray-400'}`} />
                          <span className="text-xs truncate">{item.title}</span>
                          {item.highlight && !item.active && (
                            <Badge className="ml-auto h-4 text-[10px] bg-[#9b87f5]/20 text-[#9b87f5] hover:bg-[#9b87f5]/30">
                              New
                            </Badge>
                          )}
                          {item.active && (
                            <div className="ml-auto">
                              <ChevronRight className="h-3 w-3 text-[#9b87f5]" />
                            </div>
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </motion.div>
                ))}
              </div>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        
        {isAuthenticated && (isAdmin || isInstructor) && <SidebarGroup className="mt-4">
            <SidebarGroupLabel className="text-gray-500 dark:text-gray-400 font-medium px-2 py-1 text-[10px] uppercase tracking-wider">
              {isAdmin ? 'Administration' : 'Instructor Tools'}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {isAdmin && adminMenuItems.map(item => <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={item.active} className={`transition-all duration-200 ${item.active ? 'bg-[#9b87f5]/10 text-[#9b87f5] font-medium' : 'text-gray-700 dark:text-gray-400 hover:text-[#9b87f5] hover:bg-[#9b87f5]/5'}`}>
                      <Link to={item.url} className="flex items-center space-x-2 rounded-md px-2 py-1.5">
                        <item.icon className={`h-3.5 w-3.5 flex-shrink-0 ${item.active ? 'text-[#9b87f5]' : 'text-gray-500'}`} />
                        <span className="text-xs truncate">{item.title}</span>
                        {item.active && <div className="ml-auto">
                          <ChevronRight className="h-3 w-3 text-[#9b87f5]" />
                        </div>}
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
