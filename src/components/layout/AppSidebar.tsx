
import { BookOpen, Home, BarChart2, UserCircle, GraduationCap, Settings, Calendar, Bell, Users, FileText, Briefcase, Award, ChevronRight, Bot, MessageSquare, FileUp, Eye } from 'lucide-react';
import { useLocation, Link } from 'react-router-dom';
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
  SidebarTrigger,
  SidebarFooter,
  SidebarRail,
} from '@/components/ui/sidebar';
import { useAuth } from '@/contexts/AuthContext';

const AppSidebar = () => {
  const location = useLocation();
  const { user, isAuthenticated } = useAuth();
  
  const publicMenuItems = [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: Home,
      active: location.pathname === '/dashboard',
    },
    {
      title: "Courses",
      url: "/courses",
      icon: BookOpen,
      active: location.pathname.startsWith('/courses'),
    },
    {
      title: "Resources",
      url: "/resources",
      icon: FileText,
      active: location.pathname === '/resources' && !location.pathname.includes('/admin/resources'),
    },
    {
      title: "Data Blueprint",
      url: "/resources/data-blueprint",
      icon: FileText,
      active: location.pathname === '/resources/data-blueprint',
    },
    {
      title: "Explore Data Careers",
      url: "/explore-data-careers",
      icon: Briefcase,
      active: location.pathname === '/explore-data-careers',
    },
    {
      title: "Events",
      url: "/events",
      icon: Calendar,
      active: location.pathname === '/events' && !location.pathname.includes('/admin/events'),
    },
    {
      title: "Assistants",
      url: "/assistants",
      icon: Bot,
      active: location.pathname === '/assistants' || location.pathname.startsWith('/assistant/'),
    },
    {
      title: "Notifications",
      url: "/notifications",
      icon: Bell,
      active: location.pathname === '/notifications',
    },
  ];

  // Add authenticated-only menu items
  const authenticatedMenuItems = [
    {
      title: "Messages",
      url: "/messages",
      icon: MessageSquare,
      active: location.pathname.startsWith('/messages'),
    },
    {
      title: "Resume",
      url: "/resume",
      icon: FileUp,
      active: location.pathname.startsWith('/resume'),
    },
    {
      title: "Profile",
      url: "/profile",
      icon: UserCircle,
      active: location.pathname === '/profile',
    },
  ];

  const adminMenuItems = [
    {
      title: "Admin Dashboard",
      url: "/admin",
      icon: BarChart2,
      active: location.pathname === '/admin' || location.pathname === '/admin/activity',
    },
    {
      title: "Manage Courses",
      url: "/admin/courses",
      icon: GraduationCap,
      active: location.pathname === '/admin/courses',
    },
    {
      title: "Manage Users",
      url: "/admin/users",
      icon: Users,
      active: location.pathname === '/admin/users',
    },
    {
      title: "Manage Enrollments",
      url: "/admin/enrollments",
      icon: FileText,
      active: location.pathname === '/admin/enrollments',
    },
    {
      title: "Manage Certificates",
      url: "/admin/certificates",
      icon: Award,
      active: location.pathname === '/admin/certificates',
    },
    {
      title: "Manage Resources",
      url: "/admin/resources",
      icon: FileText,
      active: location.pathname === '/admin/resources',
    },
    {
      title: "Manage Events",
      url: "/admin/events",
      icon: Calendar,
      active: location.pathname === '/admin/events',
    },
    {
      title: "Page Visibility",
      url: "/admin/page-visibility",
      icon: Eye,
      active: location.pathname === '/admin/page-visibility',
    },
    {
      title: "Settings",
      url: "/admin/settings",
      icon: Settings,
      active: location.pathname === '/admin/settings',
    },
  ];

  const isAdmin = user?.role === 'admin';
  
  // Determine which menu items to show based on authentication status
  const menuItems = [...publicMenuItems];
  
  if (isAuthenticated) {
    // Add authenticated-only items
    menuItems.push(...authenticatedMenuItems);
  }

  return (
    <Sidebar className="bg-white border-r border-gray-100 shadow-sm">
      <SidebarHeader className="border-b border-gray-100">
        <div className="flex items-center space-x-2 px-4 py-3">
          <Link to="/" className="flex items-center space-x-2">
            <GraduationCap className="h-6 w-6 text-primary" />
            <span className="font-bold text-lg text-gray-800">Insights Collective</span>
          </Link>
        </div>
        <SidebarTrigger className="text-gray-500 hover:text-primary" />
      </SidebarHeader>
      
      <SidebarContent className="py-2">
        <SidebarGroup>
          <SidebarGroupLabel className="text-gray-500 font-medium px-4 py-2">Main Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild
                    isActive={item.active}
                    className={`transition-all duration-200 hover:bg-gray-50 ${item.active 
                      ? 'bg-primary/5 text-primary font-medium border-l-2 border-primary' 
                      : 'text-gray-700 hover:text-primary'}`}
                  >
                    <Link to={item.url} className="flex items-center space-x-3 rounded-md px-3 py-2">
                      <item.icon className={`h-5 w-5 ${item.active ? 'text-primary' : 'text-gray-500'}`} />
                      <span>{item.title}</span>
                      {item.active && <div className="ml-auto">
                        <ChevronRight className="h-4 w-4" />
                      </div>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        
        {isAuthenticated && isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-gray-500 font-medium px-4 py-2">Administration</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminMenuItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton 
                      asChild
                      isActive={item.active}
                      className={`transition-all duration-200 hover:bg-gray-50 ${item.active 
                        ? 'bg-primary/5 text-primary font-medium border-l-2 border-primary' 
                        : 'text-gray-700 hover:text-primary'}`}
                    >
                      <Link to={item.url} className="flex items-center space-x-3 rounded-md px-3 py-2">
                        <item.icon className={`h-5 w-5 ${item.active ? 'text-primary' : 'text-gray-500'}`} />
                        <span>{item.title}</span>
                        {item.active && <div className="ml-auto">
                          <ChevronRight className="h-4 w-4" />
                        </div>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      
      <SidebarFooter className="border-t border-gray-100 mt-auto">
        <div className="px-4 py-3">
          <div className="text-xs text-gray-500">
            <p>Insights Collective v1.0</p>
          </div>
        </div>
      </SidebarFooter>
      
      <SidebarRail />
    </Sidebar>
  );
};

export default AppSidebar;
