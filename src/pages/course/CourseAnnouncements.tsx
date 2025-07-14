// ABOUTME: Course announcements page showing instructor announcements and updates
// ABOUTME: Canvas/Blackboard-style announcements with dates, priority levels, and read status

import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  MessageCircle, 
  Clock, 
  Pin,
  Bell,
  AlertTriangle,
  Info,
  CheckCircle,
  Calendar
} from 'lucide-react';
import { CourseLayout } from '@/components/course/CourseLayout';
import { useCourseData } from '@/hooks/useCourseData';

export default function CourseAnnouncements() {
  const { courseId } = useParams();
  const { course, isLoading, error } = useCourseData(courseId);

  // Mock announcements data
  const announcements = [
    {
      id: '1',
      title: 'Welcome to Machine Learning Foundations!',
      content: 'Welcome to our course! Please review the syllabus and course schedule. Our first live session will be next Monday at 2 PM EST.',
      author: 'Dr. Sarah Johnson',
      authorAvatar: 'https://images.unsplash.com/photo-1494790108755-2616b04c2a07',
      date: '2024-01-15',
      priority: 'high',
      pinned: true,
      read: false
    },
    {
      id: '2',
      title: 'Assignment 1 Due Date Extended',
      content: 'Due to technical issues with the submission system, Assignment 1 deadline has been extended to Friday, January 26th at 11:59 PM.',
      author: 'Dr. Sarah Johnson',
      authorAvatar: 'https://images.unsplash.com/photo-1494790108755-2616b04c2a07',
      date: '2024-01-20',
      priority: 'high',
      pinned: true,
      read: true
    },
    {
      id: '3',
      title: 'Office Hours This Week',
      content: 'I will be holding office hours on Wednesday 3-5 PM and Friday 1-3 PM. Feel free to drop by with any questions about the course material.',
      author: 'Dr. Sarah Johnson',
      authorAvatar: 'https://images.unsplash.com/photo-1494790108755-2616b04c2a07',
      date: '2024-01-18',
      priority: 'normal',
      pinned: false,
      read: true
    },
    {
      id: '4',
      title: 'New Resources Added',
      content: 'I\'ve added some additional reading materials to Module 2. These are optional but will help deepen your understanding of data preprocessing techniques.',
      author: 'Dr. Sarah Johnson',
      authorAvatar: 'https://images.unsplash.com/photo-1494790108755-2616b04c2a07',
      date: '2024-01-17',
      priority: 'low',
      pinned: false,
      read: true
    },
    {
      id: '5',
      title: 'Study Group Formation',
      content: 'Students interested in forming study groups, please use the discussion forum to connect with classmates in your timezone.',
      author: 'Teaching Assistant',
      authorAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d',
      date: '2024-01-16',
      priority: 'normal',
      pinned: false,
      read: true
    }
  ];

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'normal':
        return <Info className="h-4 w-4 text-blue-500" />;
      case 'low':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      default:
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high':
        return <Badge className="bg-red-100 text-red-800 border-red-200">High Priority</Badge>;
      case 'normal':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Normal</Badge>;
      case 'low':
        return <Badge className="bg-green-100 text-green-800 border-green-200">Low Priority</Badge>;
      default:
        return null;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  if (isLoading) {
    return (
      <CourseLayout>
        <div className="space-y-6">
          <div className="animate-pulse">
            <div className="h-8 bg-muted rounded w-1/3 mb-4"></div>
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-32 bg-muted rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </CourseLayout>
    );
  }

  return (
    <CourseLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="border-b pb-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold mb-2">Announcements</h1>
              <p className="text-muted-foreground">
                Latest updates and important information from your instructor
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                <Bell className="h-4 w-4 mr-2" />
                Notification Settings
              </Button>
            </div>
          </div>
        </div>

        {/* Announcements List */}
        <div className="space-y-4">
          {announcements.map((announcement) => (
            <Card 
              key={announcement.id} 
              className={`relative ${!announcement.read ? 'border-primary/50 bg-primary/5' : ''}`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    {announcement.pinned && (
                      <Pin className="h-4 w-4 text-primary mt-1" />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <CardTitle className="text-lg">{announcement.title}</CardTitle>
                        {!announcement.read && (
                          <div className="h-2 w-2 bg-primary rounded-full"></div>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={announcement.authorAvatar} />
                            <AvatarFallback>{announcement.author.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <span>{announcement.author}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>{formatDate(announcement.date)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getPriorityIcon(announcement.priority)}
                    {getPriorityBadge(announcement.priority)}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground leading-relaxed">
                  {announcement.content}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Empty State */}
        {announcements.length === 0 && (
          <Card>
            <CardContent className="text-center py-12">
              <MessageCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Announcements Yet</h3>
              <p className="text-muted-foreground">
                Your instructor hasn't posted any announcements yet. Check back later for updates.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </CourseLayout>
  );
}