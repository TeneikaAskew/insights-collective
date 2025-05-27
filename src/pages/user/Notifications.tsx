
import React from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Bell, Mail, Calendar, MessageSquare, CheckCircle } from 'lucide-react';

const Notifications = () => {
  const notifications = [
    {
      id: '1',
      type: 'course',
      title: 'New Course Available',
      message: 'Advanced Data Science with Python is now available',
      timestamp: '2 hours ago',
      read: false,
      icon: <Bell className="h-4 w-4" />
    },
    {
      id: '2',
      type: 'message',
      title: 'New Message',
      message: 'You have a new message from your mentor',
      timestamp: '4 hours ago',
      read: false,
      icon: <MessageSquare className="h-4 w-4" />
    },
    {
      id: '3',
      type: 'event',
      title: 'Upcoming Event',
      message: 'Data Science Workshop starts in 2 days',
      timestamp: '1 day ago',
      read: true,
      icon: <Calendar className="h-4 w-4" />
    },
    {
      id: '4',
      type: 'achievement',
      title: 'Achievement Unlocked',
      message: 'You completed the Python Fundamentals course!',
      timestamp: '2 days ago',
      read: true,
      icon: <CheckCircle className="h-4 w-4" />
    }
  ];

  return (
    <AppLayout>
      <div className="container mx-auto py-8 px-4 space-y-8">
        <div className="flex justify-between items-center">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tight">Notifications</h1>
            <p className="text-xl text-muted-foreground">
              Stay updated with your latest activities and messages
            </p>
          </div>
          <Button variant="outline">
            Mark All as Read
          </Button>
        </div>

        <div className="space-y-4">
          {notifications.map((notification) => (
            <Card key={notification.id} className={`${!notification.read ? 'border-l-4 border-l-primary' : ''}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-full">
                      {notification.icon}
                    </div>
                    <div>
                      <CardTitle className="text-base">{notification.title}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        {notification.message}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!notification.read && (
                      <Badge variant="default" className="text-xs">
                        New
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {notification.timestamp}
                    </span>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>

        {notifications.length === 0 && (
          <Card>
            <CardContent className="text-center py-12">
              <Mail className="h-16 w-16 text-muted-foreground/40 mx-auto mb-4" />
              <h3 className="text-xl font-medium mb-2">No notifications</h3>
              <p className="text-muted-foreground">
                You're all caught up! Check back later for new updates.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
};

export default Notifications;
