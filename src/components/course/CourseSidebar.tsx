// ABOUTME: Course-specific sidebar navigation component for LMS-style course interface
// ABOUTME: Provides navigation within a specific course context with sections like Home, Modules, Announcements, etc.

import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { 
  Home, 
  BookOpen, 
  MessageCircle, 
  Calendar, 
  FileText, 
  BarChart3, 
  Users, 
  Settings,
  ChevronLeft,
  User,
  TrendingUp,
  GraduationCap
} from 'lucide-react';
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
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useCourseData } from '@/hooks/useCourseData';
import { useAuth } from '@/contexts/AuthContext';
import { useCoursePermissions } from '@/hooks/useCoursePermissions';

const courseNavItems = [
  { title: 'Home', url: '', icon: Home },
  { title: 'Modules', url: '/modules', icon: BookOpen },
  { title: 'Announcements', url: '/announcements', icon: MessageCircle },
  { title: 'Assignments', url: '/assignments', icon: FileText },
  { title: 'Grades', url: '/grades', icon: BarChart3, studentTitle: 'My Grades' },
  { title: 'Progress', url: '/progress', icon: TrendingUp, studentOnly: true },
  { title: 'Gradebook', url: '/gradebook', icon: GraduationCap, instructorOnly: true },
  { title: 'Calendar', url: '/calendar', icon: Calendar },
  { title: 'People', url: '/people', icon: Users },
];

export function CourseSidebar() {
  const { open, isMobile } = useSidebar();
  const location = useLocation();
  const { courseId } = useParams();
  const { course, isLoading } = useCourseData(courseId);
  const { user } = useAuth();
  const { isInstructor } = useCoursePermissions(courseId);
  
  const currentPath = location.pathname;
  const basePath = `/courses/${courseId}`;
  
  const isActive = (itemUrl: string) => {
    const fullPath = `${basePath}${itemUrl}`;
    return currentPath === fullPath || (itemUrl === '' && currentPath === basePath);
  };

  const getNavClassName = (itemUrl: string) => {
    return isActive(itemUrl) 
      ? 'bg-primary/10 text-primary font-medium border-r-2 border-primary' 
      : 'hover:bg-muted/50';
  };

  // Filter nav items based on user role
  const filteredNavItems = courseNavItems.filter(item => {
    if (item.instructorOnly && !isInstructor) return false;
    if (item.studentOnly && isInstructor) return false;
    return true;
  });

  if (isLoading) {
    return (
      <Sidebar className={!open ? 'w-14' : 'w-64'} collapsible="icon">
        <SidebarContent>
          <div className="animate-pulse p-4">
            <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
            <div className="h-3 bg-muted rounded w-1/2"></div>
          </div>
        </SidebarContent>
      </Sidebar>
    );
  }

  return (
    <Sidebar className={!open ? 'w-14' : 'w-64'} collapsible="icon">
      <SidebarHeader className="border-b">
        <div className="p-4">
          <Button variant="ghost" size="sm" asChild className="mb-4 w-full justify-start">
            <Link to="/enrolled-courses">
              <ChevronLeft className="h-4 w-4 mr-2" />
              {open && 'Back to Courses'}
            </Link>
          </Button>
          
          {open && course && (
            <div>
              <h2 className="font-semibold text-lg line-clamp-2 mb-1">
                {course.title}
              </h2>
              <p className="text-sm text-muted-foreground">
                {course.category} • {course.level}
              </p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <Link 
                      to={`${basePath}${item.url}`} 
                      className={getNavClassName(item.url)}
                    >
                      <item.icon className="h-4 w-4" />
                      {open && <span>{
                        (item.studentTitle && !isInstructor) ? item.studentTitle : item.title
                      }</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {open && course?.instructor && (
          <SidebarGroup>
            <SidebarGroupLabel>Instructor</SidebarGroupLabel>
            <SidebarGroupContent>
              <div className="px-3 py-2">
                <div className="flex items-center space-x-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={course.instructor.avatar} />
                    <AvatarFallback>
                      {course.instructor.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {course.instructor.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Instructor
                    </p>
                  </div>
                </div>
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}