import { BookOpen, Home, BarChart2, UserCircle, GraduationCap, Settings, Calendar, Bell, Users, FileText, Briefcase, Award, ChevronRight, Bot, MessageSquare, FileUp, Eye, Compass, FileCheck, FormInput, Newspaper } from 'lucide-react';
import { useLocation, Link } from 'react-router-dom';
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarTrigger, SidebarFooter, SidebarRail } from '@/components/ui/sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { motion } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
const AppSidebar = () => {
  const location = useLocation();
  const {
    user,
    isAuthenticated
  } = useAuth();
  const publicMenuItems = [{
    title: "Dashboard",
    url: "/dashboard",
    icon: Home,
    active: location.pathname === '/dashboard'
  }, {
    title: "Courses",
    url: "/courses",
    icon: BookOpen,
    active: location.pathname.startsWith('/courses') && !location.pathname.includes('/forums')
  }, {
    title: "Resources",
    url: "/resources",
    icon: FileText,
    active: location.pathname === '/resources' && !location.pathname.includes('/admin/resources')
  }, {
    title: "Data Blueprint",
    url: "/data-blueprint",
    icon: FileText,
    active: location.pathname === '/data-blueprint'
  }, {
    title: "Explore Careers",
    url: "/explore-data-careers",
    icon: Compass,
    active: location.pathname === '/explore-data-careers'
  }, {
    title: "Career Pathway",
    url: "/career-pathway",
    icon: Briefcase,
    active: location.pathname === '/career-pathway'
  }, {
    title: "Career Agent",
    url: "/career-agent",
    icon: Bot,
    active: location.pathname === '/career-agent'
  }, {
    title: "AI & Automation Fellowship",
    url: "/survey",
    icon: FileCheck,
    active: location.pathname === '/survey' || location.pathname === '/survey-confirmation'
  }, {
    title: "Forums",
    url: "/forums",
    icon: MessageSquare,
    active: location.pathname === '/forums' || location.pathname.includes('/forums/') || location.pathname.includes('/threads/')
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
    title: "Notifications",
    url: "/notifications",
    icon: Bell,
    active: location.pathname === '/notifications'
  }];
  const authenticatedMenuItems = [{
    title: "Messages",
    url: "/messages",
    icon: MessageSquare,
    active: location.pathname.startsWith('/messages')
  }, {
    title: "Resume",
    url: "/resume",
    icon: FileUp,
    active: location.pathname.startsWith('/resume')
  }, {
    title: "Profile",
    url: "/profile",
    icon: UserCircle,
    active: location.pathname === '/profile'
  }];
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
    title: "Manage Enrollments",
    url: "/admin/enrollments",
    icon: FileText,
    active: location.pathname === '/admin/enrollments'
  }, {
    title: "Manage Certificates",
    url: "/admin/certificates",
    icon: Award,
    active: location.pathname === '/admin/certificates'
  }, {
    title: "Manage Resources",
    url: "/admin/resources",
    icon: FileText,
    active: location.pathname === '/admin/resources'
  }, {
    title: "Manage Blog",
    url: "/admin/blog",
    icon: Newspaper,
    active: location.pathname === '/admin/blog' || location.pathname.includes('/admin/blog/')
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
    title: "Settings",
    url: "/admin/settings",
    icon: Settings,
    active: location.pathname === '/admin/settings'
  }, {
    title: "Debugging",
    url: "@src/components/LocalStorageDebug",
    icon: Settings,
    active: location.pathname === '@src/components/LocalStorageDebug'
  }];
  const isAdmin = user?.roles?.includes('admin');
  const isInstructor = user?.roles?.includes('instructor');
  const menuItems = [...publicMenuItems];
  if (isAuthenticated) {
    menuItems.push(...authenticatedMenuItems);
  }
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
  return <Sidebar className="border-r border-gray-200 dark:border-gray-800 text-gray-800 dark:text-gray-200">
      <SidebarHeader className="border-b border-gray-200 dark:border-gray-800 px-2 bg-gray-100">
        <div className="flex items-center space-x-2 p-3">
          <Link to="/" className="flex items-center space-x-2">
            <div className="relative w-8 h-8 flex items-center justify-center rounded-md bg-gradient-to-tr from-[#9b87f5] to-[#7E69AB]">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-lg">Insights Collective</span>
          </Link>
        </div>
        <SidebarTrigger className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 absolute right-2 top-3" />
      </SidebarHeader>
      
      <SidebarContent className="py-4 px-2 bg-gray-50 dark:bg-gray-900">
        {isAuthenticated && <div className="mb-6 px-2">
            <div className="flex items-center space-x-3 mb-4">
              <Avatar className="border-2 border-[#9b87f5]/20">
                <AvatarImage src={user?.avatar || ''} alt="User avatar" />
                <AvatarFallback className="bg-[#9b87f5]/10 text-[#9b87f5]">
                  {user?.email?.charAt(0).toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium text-sm">
                  {user?.name || user?.email?.split('@')[0] || 'User'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{isAdmin ? 'Administrator' : isInstructor ? 'Instructor' : 'Member'}</p>
              </div>
            </div>
          </div>}
      
        <SidebarGroup>
          <SidebarGroupLabel className="text-gray-500 dark:text-gray-400 font-medium px-3 py-2 text-xs uppercase tracking-wider">
            Main Menu
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item, index) => <motion.div key={item.title} custom={index} initial="hidden" animate="visible" variants={menuItemVariants}>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={item.active} className={`transition-all duration-200 ${item.active ? 'bg-[#9b87f5]/10 text-[#9b87f5] font-medium' : 'text-gray-700 dark:text-gray-300 hover:text-[#9b87f5] hover:bg-[#9b87f5]/5'}`}>
                      <Link to={item.url} className="flex items-center space-x-3 rounded-md px-3 py-2">
                        <item.icon className={`h-5 w-5 ${item.active ? 'text-[#9b87f5]' : 'text-gray-500 dark:text-gray-400'}`} />
                        <span>{item.title}</span>
                        {item.active && <div className="ml-auto">
                          <ChevronRight className="h-4 w-4 text-[#9b87f5]" />
                        </div>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </motion.div>)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        
        {isAuthenticated && (isAdmin || isInstructor) && <SidebarGroup className="mt-6">
            <SidebarGroupLabel className="text-gray-500 dark:text-gray-400 font-medium px-3 py-2 text-xs uppercase tracking-wider">
              {isAdmin ? 'Administration' : 'Instructor Tools'}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {isAdmin && adminMenuItems.map(item => <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={item.active} className={`transition-all duration-200 ${item.active ? 'bg-[#9b87f5]/10 text-[#9b87f5] font-medium' : 'text-gray-700 dark:text-gray-400 hover:text-[#9b87f5] hover:bg-[#9b87f5]/5'}`}>
                      <Link to={item.url} className="flex items-center space-x-3 rounded-md px-3 py-2">
                        <item.icon className={`h-5 w-5 ${item.active ? 'text-[#9b87f5]' : 'text-gray-500'}`} />
                        <span>{item.title}</span>
                        {item.active && <div className="ml-auto">
                          <ChevronRight className="h-4 w-4 text-[#9b87f5]" />
                        </div>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>)}
                
                {isInstructor && !isAdmin && <SidebarMenuItem>
                    <SidebarMenuButton asChild className="text-gray-700 dark:text-gray-400 hover:text-[#9b87f5] hover:bg-[#9b87f5]/5">
                      <Link to="/instructor/courses" className="flex items-center space-x-3 rounded-md px-3 py-2">
                        <BookOpen className="h-5 w-5 text-gray-500" />
                        <span>My Courses</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>}
      </SidebarContent>
      
      <SidebarFooter className="border-t border-gray-200 dark:border-gray-800 mt-auto p-4 bg-gray-50 dark:bg-gray-900">
        {!isAuthenticated ? <div className="space-y-2 px-2">
            <Button variant="outline" asChild className="w-full justify-start">
              <Link to="/login">Sign In</Link>
            </Button>
            <Button asChild className="w-full justify-start bg-[#9b87f5] hover:bg-[#8B5CF6] text-white">
              <Link to="/register">Create Account</Link>
            </Button>
          </div> : <div className="text-xs text-gray-500 dark:text-gray-400 px-2">
            <p>Insights Collective v1.0</p>
          </div>}
      </SidebarFooter>
      
      <SidebarRail />
    </Sidebar>;
};
export default AppSidebar;
