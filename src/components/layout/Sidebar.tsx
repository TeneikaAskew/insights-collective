
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Home, 
  BookOpen, 
  Calendar, 
  MessageSquare, 
  Briefcase, 
  User, 
  Star,
  PenTool,
  Sparkles,
  Code,
  MessageCircle,
  Settings,
  Users,
  BarChart3,
  FileText,
  Newspaper
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const navigation = [
  { name: 'Home', href: '/', icon: Home },
  { name: 'Courses', href: '/courses', icon: BookOpen },
  { name: 'Events', href: '/events', icon: Calendar },
  { name: 'Blog', href: '/blog', icon: Newspaper },
  { name: 'Messages', href: '/messages', icon: MessageSquare },
  { name: 'Interview Prep', href: '/interview-prep', icon: Briefcase },
  { name: 'Portfolio Explorer', href: '/portfolio-explorer', icon: PenTool },
  { name: 'Career Pathway', href: '/career-pathway', icon: Star },
  { name: 'Careers Explorer', href: '/careers', icon: Sparkles },
  { name: 'Resources', href: '/resources', icon: FileText },
  { name: 'AI Assistant', href: '/ai', icon: Sparkles },
  { name: 'Code Practice', href: '/code-practice', icon: Code },
  { name: 'Forum', href: '/forum', icon: MessageCircle },
];

const adminNavigation = [
  { name: 'Admin Dashboard', href: '/admin', icon: BarChart3 },
  { name: 'Manage Events', href: '/admin/events', icon: Calendar },
  { name: 'Manage Blog', href: '/admin/blog', icon: Newspaper },
  { name: 'Manage Courses', href: '/admin/courses', icon: BookOpen },
  { name: 'Manage Forms', href: '/admin/forms', icon: FileText },
  { name: 'User Management', href: '/admin/users', icon: Users },
];

export default function Sidebar() {
  const location = useLocation();
  const { profiles } = useAuth();
  
  const isAdmin = profiles?.roles?.includes('admin');

  const isActivePath = (href: string) => {
    if (href === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(href);
  };

  return (
    <div className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0">
      <div className="flex flex-col flex-grow pt-5 bg-white border-r border-gray-200 overflow-y-auto">
        <div className="flex items-center flex-shrink-0 px-4">
          <Link to="/" className="flex items-center">
            <div className="w-8 h-8 bg-[#9b87f5] rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">DS</span>
            </div>
            <span className="ml-2 text-xl font-bold text-gray-900">DataSkills</span>
          </Link>
        </div>
        <div className="mt-5 flex-grow flex flex-col">
          <nav className="flex-1 px-2 pb-4 space-y-1">
            {navigation.map((item) => {
              const isActive = isActivePath(item.href);
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`${
                    isActive
                      ? 'bg-[#9b87f5] text-white'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  } group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors duration-150`}
                >
                  <item.icon
                    className={`${
                      isActive ? 'text-white' : 'text-gray-400 group-hover:text-gray-500'
                    } mr-3 flex-shrink-0 h-5 w-5`}
                    aria-hidden="true"
                  />
                  {item.name}
                </Link>
              );
            })}
            
            {isAdmin && (
              <>
                <div className="border-t border-gray-200 my-4"></div>
                <div className="px-2 mb-2">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Admin
                  </h3>
                </div>
                {adminNavigation.map((item) => {
                  const isActive = isActivePath(item.href);
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      className={`${
                        isActive
                          ? 'bg-red-100 text-red-900'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      } group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors duration-150`}
                    >
                      <item.icon
                        className={`${
                          isActive ? 'text-red-500' : 'text-gray-400 group-hover:text-gray-500'
                        } mr-3 flex-shrink-0 h-5 w-5`}
                        aria-hidden="true"
                      />
                      {item.name}
                    </Link>
                  );
                })}
              </>
            )}
          </nav>
        </div>
        <div className="flex-shrink-0 flex border-t border-gray-200 p-4">
          <Link to="/profile" className="flex-shrink-0 w-full group block">
            <div className="flex items-center">
              <div>
                <User className="inline-block h-8 w-8 rounded-full bg-gray-200 p-1 text-gray-600" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                  {profiles?.first_name && profiles?.last_name 
                    ? `${profiles.first_name} ${profiles.last_name}`
                    : 'Your Profile'
                  }
                </p>
                <p className="text-xs font-medium text-gray-500">View profile</p>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
