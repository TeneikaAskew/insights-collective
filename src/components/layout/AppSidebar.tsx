
import { BookOpen, Home, BarChart2, UserCircle, GraduationCap, Settings, Calendar, Bell, Users, FileText, Briefcase, Award, ChevronRight } from 'lucide-react';
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
  
  const studentMenuItems = [
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
      active: location.pathname.startsWith('/resources') && !location.pathname.includes('/admin/resources'),
      subItems: [
        {
          title: "Data Blueprint Series",
          url: "/resources/data-blueprint",
          active: location.pathname === '/resources/data-blueprint',
        }
      ]
    },
    {
      title: "Explore Data Careers",
      url: "/explore-data-careers",
      icon: Briefcase,
      active: location.pathname === '/explore-data-careers',
    },
    {
      title: "Calendar",
      url: "/calendar",
      icon: Calendar,
      active: location.pathname === '/calendar',
    },
    {
      title: "Notifications",
      url: "/notifications",
      icon: Bell,
      active: location.pathname === '/notifications',
    },
  ];

  // Add profile only if user is authenticated
  if (isAuthenticated) {
    studentMenuItems.push({
      title: "Profile",
      url: "/profile",
      icon: UserCircle,
      active: location.pathname === '/profile',
    });
  }

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
      title: "Settings",
      url: "/admin/settings",
      icon: Settings,
      active: location.pathname === '/admin/settings',
    },
  ];

  const isAdmin = user?.role === 'admin';

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center space-x-2 px-4 py-3">
          <GraduationCap className="h-6 w-6 text-sidebar-primary" />
          <span className="font-bold text-lg">Insights Collective</span>
        </div>
        <SidebarTrigger />
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Main Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {!isAdmin && studentMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={item.active}>
                    <Link to={item.url}>
                      {item.icon && <item.icon className="h-5 w-5" />}
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                  {item.subItems && item.subItems.length > 0 && (
                    <div className="pl-8 mt-1 space-y-1">
                      {item.subItems.map((subItem) => (
                        <SidebarMenuButton key={subItem.title} asChild isActive={subItem.active}>
                          <Link to={subItem.url} className="text-sm">
                            <ChevronRight className="h-3 w-3 mr-1" />
                            <span>{subItem.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      ))}
                    </div>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        
        {isAuthenticated && isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Administration</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminMenuItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={item.active}>
                      <Link to={item.url}>
                        <item.icon className="h-5 w-5" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      
      <SidebarFooter>
        <div className="px-3 py-2">
          <div className="text-xs text-muted-foreground">
            <p>Insights Collective v1.0</p>
          </div>
        </div>
      </SidebarFooter>
      
      <SidebarRail />
    </Sidebar>
  );
};

export default AppSidebar;
