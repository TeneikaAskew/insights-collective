
import { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Bell, Book, CheckCircle, Clock, MessageSquare } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { mockService } from '@/lib/mockData';
import { useToast } from '@/hooks/use-toast';
import { Notification } from '@/types';

type NotificationItem = {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'assignment' | 'quiz' | 'announcement' | 'feedback';
  isRead: boolean;
  createdAt: string;
  link?: string;
};

const NotificationTypeIcon = ({ type }: { type: string }) => {
  switch (type) {
    case 'assignment':
      return <Book className="h-5 w-5 text-blue-500" />;
    case 'quiz':
      return <Clock className="h-5 w-5 text-amber-500" />;
    case 'announcement':
      return <Bell className="h-5 w-5 text-purple-500" />;
    case 'feedback':
      return <MessageSquare className="h-5 w-5 text-green-500" />;
    default:
      return <Bell className="h-5 w-5 text-primary" />;
  }
};

const NotificationCard = ({ 
  notification, 
  onMarkAsRead 
}: { 
  notification: Notification; 
  onMarkAsRead: (id: string) => void;
}) => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Card className={`mb-4 border-l-4 ${notification.isRead ? 'border-l-transparent' : 'border-l-primary'}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <NotificationTypeIcon type={notification.type} />
          </div>
          <div className="flex-1">
            <div className="flex justify-between items-start">
              <div>
                <h3 className={`font-semibold ${notification.isRead ? '' : 'text-primary'}`}>{notification.title}</h3>
                <p className="text-sm text-muted-foreground mt-1">{notification.message}</p>
              </div>
              <div className="text-xs text-muted-foreground">
                {formatDate(notification.createdAt)}
              </div>
            </div>
            <div className="flex justify-between items-center mt-4">
              {notification.link && (
                <Button variant="outline" size="sm" asChild>
                  <a href={notification.link}>View Details</a>
                </Button>
              )}
              {!notification.isRead && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="ml-auto" 
                  onClick={() => onMarkAsRead(notification.id)}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Mark as Read
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const Notifications = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Get notifications for the user
  const initialNotifications = user ? mockService.getUserNotifications(user.id) : [];
  const [notifications, setNotifications] = useState(initialNotifications);
  
  const unreadCount = notifications.filter(n => !n.isRead).length;
  
  const handleMarkAsRead = (id: string) => {
    setNotifications(prev => 
      prev.map(notification => 
        notification.id === id 
          ? { ...notification, isRead: true } 
          : notification
      )
    );
    
    toast({
      title: "Notification marked as read",
      description: "This notification has been marked as read.",
    });
  };
  
  const handleMarkAllAsRead = () => {
    setNotifications(prev => 
      prev.map(notification => ({ ...notification, isRead: true }))
    );
    
    toast({
      title: "All notifications marked as read",
      description: `${unreadCount} notifications have been marked as read.`,
    });
  };
  
  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
            <p className="text-muted-foreground mt-1">
              Stay updated with the latest activity from your courses and the platform.
            </p>
          </div>
          {unreadCount > 0 && (
            <Button onClick={handleMarkAllAsRead}>
              <CheckCircle className="h-4 w-4 mr-2" />
              Mark All as Read
            </Button>
          )}
        </div>
        
        {notifications.length > 0 ? (
          <div className="space-y-2">
            {notifications.map(notification => (
              <NotificationCard 
                key={notification.id} 
                notification={notification} 
                onMarkAsRead={handleMarkAsRead}
              />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Bell className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-medium mb-2">No Notifications</h3>
              <p className="text-muted-foreground text-center max-w-md">
                You don't have any notifications at the moment. When you get new notifications, they'll appear here.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
};

export default Notifications;
