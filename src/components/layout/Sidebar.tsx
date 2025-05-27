
import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '../ui/button';
import {
  LayoutDashboard,
  LayoutList,
  UserPlus,
  Users,
  Book,
  Calendar,
  Settings as SettingsIcon,
  HelpCircle,
  Layout,
  PanelLeft,
  LayoutGrid,
  GraduationCap,
  BookOpen,
  CalendarDays,
  Bell,
  User,
  FileText,
  Settings,
  MessageSquare,
  LogOut,
  Building2,
  Briefcase,
  Activity,
  Users as UsersIcon,
  CheckSquare,
  FileCode,
  FileSpreadsheet,
  FileQuestion,
  FormInput,
  Bug,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface NavItem {
  title: string;
  icon: React.ComponentType<any>;
  path: string;
  children?: NavItem[];
}

interface SidebarProps {
  expanded: boolean;
  setExpanded: (expanded: boolean) => void;
  mobile?: boolean;
  onClose?: () => void;
}

const adminNavItems = [
  {
    title: 'Dashboard',
    icon: LayoutDashboard,
    path: '/admin',
  },
  {
    title: 'Activity',
    icon: Activity,
    path: '/admin/activity',
  },
  {
    title: 'Courses',
    icon: BookOpen,
    path: '/admin/courses',
    children: [
      {
        title: 'All Courses',
        path: '/admin/courses',
        icon: BookOpen,
      },
      {
        title: 'Forms',
        path: '/admin/forms',
        icon: FormInput,
      },
    ]
  },
  {
    title: 'Users',
    icon: UsersIcon,
    path: '/admin/users',
  },
  {
    title: 'Enrollments',
    icon: UserPlus,
    path: '/admin/enrollments',
  },
  {
    title: 'Certificates',
    icon: CheckSquare,
    path: '/admin/certificates',
  },
  {
    title: 'Resources',
    icon: FileCode,
    path: '/admin/resources',
  },
  {
    title: 'Events',
    icon: CalendarDays,
    path: '/admin/events',
  },
  {
    title: 'Blog Posts',
    icon: FileText,
    path: '/admin/blog',
  },
  {
    title: 'Page Visibility',
    icon: Layout,
    path: '/admin/page-visibility',
  },
  {
    title: 'Debugging Tools',
    icon: Bug,
    path: '/admin/debug',
  },
];

const Sidebar: React.FC<SidebarProps> = ({ expanded, setExpanded, mobile = false, onClose }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMounted, setIsMounted] = useState(false);

  const isAdmin = user?.roles?.includes('admin');

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return null;
  }

  const handleLogout = async () => {
    await logout();
    navigate('/login');
    if (onClose) {
      onClose();
    }
  };

  const renderNavItems = (navItems: NavItem[], isNested = false) => (
    <ul className={cn("flex flex-col space-y-1", isNested ? "pl-4" : "")}>
      {navItems.map((item) => (
        <li key={item.title}>
          {item.children ? (
            <Collapsible className="w-full">
              <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded-md hover:bg-secondary">
                <div className="flex items-center space-x-2">
                  {item.icon && <item.icon className="h-4 w-4" />}
                  <span>{item.title}</span>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                {renderNavItems(item.children, true)}
              </CollapsibleContent>
            </Collapsible>
          ) : (
            <NavLink
              to={item.path}
              className={({ isActive }) =>
                cn(
                  "flex items-center space-x-2 p-2 rounded-md hover:bg-secondary",
                  isActive ? "font-medium bg-secondary text-secondary-foreground" : "text-muted-foreground"
                )
              }
            >
              {item.icon && <item.icon className="h-4 w-4" />}
              <span>{item.title}</span>
            </NavLink>
          )}
        </li>
      ))}
    </ul>
  );

  return (
    <div
      className={cn(
        "flex flex-col h-screen bg-background border-r border-primary/10",
        expanded ? "w-64" : "w-16",
        mobile ? "fixed inset-y-0 left-0 z-50" : "hidden md:flex"
      )}
    >
      <div className="flex-1 flex flex-col space-y-1 p-2">
        <div className="flex justify-end">
          {mobile && (
            <Button variant="ghost" size="icon" onClick={onClose}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-6 w-6"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
              <span className="sr-only">Close sidebar</span>
            </Button>
          )}
        </div>
        <div className="mb-4">
          <NavLink to="/" className="flex items-center space-x-2 font-semibold">
            <LayoutGrid className="h-6 w-6" />
            {expanded && <div>Data Science Learning</div>}
          </NavLink>
        </div>
        <div className="flex-1">
          <p className="px-2 text-sm py-1">Main</p>
          <ul className="flex flex-col space-y-1">
            <li>
              <NavLink
                to="/dashboard"
                className={({ isActive }) =>
                  cn(
                    "flex items-center space-x-2 p-2 rounded-md hover:bg-secondary",
                    isActive ? "font-medium bg-secondary text-secondary-foreground" : "text-muted-foreground"
                  )
                }
              >
                <LayoutDashboard className="h-4 w-4" />
                <span>Dashboard</span>
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/courses"
                className={({ isActive }) =>
                  cn(
                    "flex items-center space-x-2 p-2 rounded-md hover:bg-secondary",
                    isActive ? "font-medium bg-secondary text-secondary-foreground" : "text-muted-foreground"
                  )
                }
              >
                <GraduationCap className="h-4 w-4" />
                <span>Courses</span>
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/resources"
                className={({ isActive }) =>
                  cn(
                    "flex items-center space-x-2 p-2 rounded-md hover:bg-secondary",
                    isActive ? "font-medium bg-secondary text-secondary-foreground" : "text-muted-foreground"
                  )
                }
              >
                <Book className="h-4 w-4" />
                <span>Resources</span>
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/events"
                className={({ isActive }) =>
                  cn(
                    "flex items-center space-x-2 p-2 rounded-md hover:bg-secondary",
                    isActive ? "font-medium bg-secondary text-secondary-foreground" : "text-muted-foreground"
                  )
                }
              >
                <Calendar className="h-4 w-4" />
                <span>Events</span>
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/forums"
                className={({ isActive }) =>
                  cn(
                    "flex items-center space-x-2 p-2 rounded-md hover:bg-secondary",
                    isActive ? "font-medium bg-secondary text-secondary-foreground" : "text-muted-foreground"
                  )
                }
              >
                <MessageSquare className="h-4 w-4" />
                <span>Forums</span>
              </NavLink>
            </li>
          </ul>
          <p className="px-2 text-sm py-1">Account</p>
          <ul className="flex flex-col space-y-1">
            <li>
              <NavLink
                to="/notifications"
                className={({ isActive }) =>
                  cn(
                    "flex items-center space-x-2 p-2 rounded-md hover:bg-secondary",
                    isActive ? "font-medium bg-secondary text-secondary-foreground" : "text-muted-foreground"
                  )
                }
              >
                <Bell className="h-4 w-4" />
                <span>Notifications</span>
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/profile"
                className={({ isActive }) =>
                  cn(
                    "flex items-center space-x-2 p-2 rounded-md hover:bg-secondary",
                    isActive ? "font-medium bg-secondary text-secondary-foreground" : "text-muted-foreground"
                  )
                }
              >
                <User className="h-4 w-4" />
                <span>Profile</span>
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/settings"
                className={({ isActive }) =>
                  cn(
                    "flex items-center space-x-2 p-2 rounded-md hover:bg-secondary",
                    isActive ? "font-medium bg-secondary text-secondary-foreground" : "text-muted-foreground"
                  )
                }
              >
                <SettingsIcon className="h-4 w-4" />
                <span>Settings</span>
              </NavLink>
            </li>
          </ul>
        </div>
        {isAdmin && (
          <>
            <p className="px-2 text-sm py-1">Admin</p>
            {renderNavItems(adminNavItems)}
          </>
        )}
        <div className="mt-auto">
          <Button variant="ghost" className="w-full" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
