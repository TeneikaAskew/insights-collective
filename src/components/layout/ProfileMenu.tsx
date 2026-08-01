// ABOUTME: Context-aware profile menu that shows different options based on current location
// ABOUTME: Provides course-specific navigation when user is in a course context

import React from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/AuthContext';
import { useCoursePermissions } from '@/hooks/useCoursePermissions';
import { useCourseData } from '@/hooks/useCourseData';
import { 
  UserCircle, 
  Home, 
  BookOpen, 
  Calendar, 
  Users, 
  Settings, 
  BarChart,
  MessageSquare,
  Award,
  Edit
} from 'lucide-react';

export function ProfileMenu() {
  const { user, isAuthenticated, isAdminAuthenticated, logout } = useAuth();
  const location = useLocation();
  const params = useParams<{ courseId?: string }>();
  const { canEdit } = useCoursePermissions(params.courseId);
  const { course } = useCourseData(params.courseId);
  
  // Check if we're in a course context
  const isInCourse = location.pathname.includes('/courses/') && params.courseId;
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full overflow-hidden">
          {user?.avatar ? (
            <img src={user.avatar} alt={user.name} className="h-8 w-8 rounded-full" />
          ) : (
            <UserCircle className="h-8 w-8" />
          )}
          <span className="sr-only">User menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 bg-background border shadow-lg z-50">
        <DropdownMenuLabel className="font-semibold">
          {user?.name || 'My Account'}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {isAuthenticated ? (
          <>
            {/* Course-specific navigation when in course context */}
            {isInCourse && course && (
              <>
                <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-wider">
                  {course.title}
                </DropdownMenuLabel>
                <DropdownMenuItem asChild>
                  <Link to={`/courses/${params.courseId}`} className="flex items-center gap-2">
                    <Home className="h-4 w-4" />
                    Course Home
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to={`/courses/${params.courseId}/modules`} className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4" />
                    Modules
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to={`/courses/${params.courseId}/assignments`} className="flex items-center gap-2">
                    <Award className="h-4 w-4" />
                    Assignments
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to={`/courses/${params.courseId}/grades`} className="flex items-center gap-2">
                    <BarChart className="h-4 w-4" />
                    Grades
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to={`/courses/${params.courseId}/people`} className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    People
                  </Link>
                </DropdownMenuItem>
                
                {canEdit && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-wider">
                      Instructor Tools
                    </DropdownMenuLabel>
                    <DropdownMenuItem asChild>
                      <Link to={`/courses/${params.courseId}/management`} className="flex items-center gap-2">
                        <Settings className="h-4 w-4" />
                        Course Management
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
              </>
            )}
            
            {/* General navigation */}
            <DropdownMenuItem asChild>
              <Link to="/profile" className="flex items-center gap-2">
                <UserCircle className="h-4 w-4" />
                Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/dashboard" className="flex items-center gap-2">
                <Home className="h-4 w-4" />
                Dashboard
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/courses" className="flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                My Courses
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/dashboard?tab=calendar" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Calendar
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/messages" className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Messages
              </Link>
            </DropdownMenuItem>
            
            {isAdminAuthenticated && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/admin" className="flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Admin Dashboard
                  </Link>
                </DropdownMenuItem>
              </>
            )}
            
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="text-destructive">
              Logout
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <DropdownMenuItem asChild>
              <Link to="/login">Login</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/register">Register</Link>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}