import React from 'react';
import { NavLink } from 'react-router-dom';
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader } from '@/components/ui/sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { ChevronLeft, ChevronRight, BookOpen, Home, User, Calendar, MessageSquare, BarChart3, Briefcase, BookMarked } from 'lucide-react';

const AppSidebar = () => {
  const { user, isAdmin } = useAuth();

  return (
    <Sidebar>
      <SidebarHeader className="flex items-center justify-between p-4">
        <span className="text-xl font-bold">Insights</span>
        <SidebarHeader.Close>
          {({ collapsed }) => (
            collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />
          )}
        </SidebarHeader.Close>
      </SidebarHeader>
      <SidebarContent>
        <div className="px-3 py-2">
          <h2 className="mb-2 px-4 text-lg font-semibold">Navigation</h2>
          <div className="space-y-1">
            <NavLink 
              to="/"
              className={({ isActive }) => `
                flex items-center rounded-md px-3 py-2 text-sm font-medium
                ${isActive 
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted transition-colors'
                }
              `}
              end
            >
              <Home className="mr-2 h-4 w-4" />
              <span>Home</span>
            </NavLink>
            <NavLink 
              to="/dashboard"
              className={({ isActive }) => `
                flex items-center rounded-md px-3 py-2 text-sm font-medium
                ${isActive 
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted transition-colors'
                }
              `}
            >
              <BarChart3 className="mr-2 h-4 w-4" />
              <span>Dashboard</span>
            </NavLink>
            <NavLink 
              to="/portfolio-explorer"
              className={({ isActive }) => `
                flex items-center rounded-md px-3 py-2 text-sm font-medium
                ${isActive 
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted transition-colors'
                }
              `}
            >
              <Briefcase className="mr-2 h-4 w-4" />
              <span>Portfolio Explorer</span>
            </NavLink>
            {user && (
              <>
                <NavLink
                  to="/courses"
                  className={({ isActive }) => `
                    flex items-center rounded-md px-3 py-2 text-sm font-medium
                    ${isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted transition-colors'
                    }
                  `}
                >
                  <BookOpen className="mr-2 h-4 w-4" />
                  <span>Courses</span>
                </NavLink>
                <NavLink
                  to={`/profile/${user.id}`}
                  className={({ isActive }) => `
                    flex items-center rounded-md px-3 py-2 text-sm font-medium
                    ${isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted transition-colors'
                    }
                  `}
                >
                  <User className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </NavLink>
                <NavLink
                  to="/calendar"
                  className={({ isActive }) => `
                    flex items-center rounded-md px-3 py-2 text-sm font-medium
                    ${isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted transition-colors'
                    }
                  `}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  <span>Calendar</span>
                </NavLink>
              </>
            )}
          </div>
          
          {isAdmin && (
            <>
              <h2 className="mt-4 mb-2 px-4 text-lg font-semibold">Admin</h2>
              <div className="space-y-1">
                <NavLink
                  to="/admin/courses"
                  className={({ isActive }) => `
                    flex items-center rounded-md px-3 py-2 text-sm font-medium
                    ${isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted transition-colors'
                    }
                  `}
                >
                  <BookOpen className="mr-2 h-4 w-4" />
                  <span>Manage Courses</span>
                </NavLink>
                <NavLink
                  to="/admin/users"
                  className={({ isActive }) => `
                    flex items-center rounded-md px-3 py-2 text-sm font-medium
                    ${isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted transition-colors'
                    }
                  `}
                >
                  <User className="mr-2 h-4 w-4" />
                  <span>Manage Users</span>
                </NavLink>
                <NavLink
                  to="/admin/page-visibility"
                  className={({ isActive }) => `
                    flex items-center rounded-md px-3 py-2 text-sm font-medium
                    ${isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted transition-colors'
                    }
                  `}
                >
                  <BookMarked className="mr-2 h-4 w-4" />
                  <span>Page Visibility</span>
                </NavLink>
              </div>
            </>
          )}
        </div>
      </SidebarContent>
      <SidebarFooter>
        {user ? (
          <div className="flex items-center justify-between p-4">
            <span className="text-sm">Logged in as {user.first_name || 'User'}</span>
          </div>
        ) : (
          <div className="flex items-center justify-between p-4">
            <span className="text-sm">Not logged in</span>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
};

export default AppSidebar;
