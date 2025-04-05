
import { useState } from 'react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Bell } from 'lucide-react';
import { Notification } from '@/types';
import NotificationItem from '@/components/common/NotificationItem';
import { useNavigate } from 'react-router-dom';

// Mock notifications data
const mockNotifications: Notification[] = [
  {
    id: '1',
    userId: 'user1',
    title: 'New Assignment',
    message: 'You have a new assignment in Data Science course',
    type: 'assignment',
    isRead: false,
    createdAt: '2023-09-01T10:30:00Z',
    link: '/courses/course1/modules/module1'
  },
  {
    id: '2',
    userId: 'user1',
    title: 'Quiz Reminder',
    message: 'Don\'t forget to complete the quiz for Machine Learning course',
    type: 'quiz',
    isRead: false,
    createdAt: '2023-09-02T14:00:00Z',
    link: '/courses/course2/modules/module2'
  },
  {
    id: '3',
    userId: 'user1',
    title: 'Course Announcement',
    message: 'Important update for your Data Engineering course',
    type: 'announcement',
    isRead: true,
    createdAt: '2023-09-03T09:15:00Z',
    link: '/courses/course3'
  }
];

const NotificationsDropdown = () => {
  const [notifications, setNotifications] = useState<Notification[]>(mockNotifications);
  const navigate = useNavigate();
  
  const unreadCount = notifications.filter(n => !n.isRead).length;
  
  const handleMarkAsRead = (id: string) => {
    setNotifications(prev => 
      prev.map(notification => 
        notification.id === id 
          ? { ...notification, isRead: true } 
          : notification
      )
    );
  };
  
  const handleMarkAllAsRead = () => {
    setNotifications(prev => 
      prev.map(notification => ({ ...notification, isRead: true }))
    );
  };
  
  const handleViewAll = () => {
    navigate('/notifications');
  };
  
  const handleViewCalendar = () => {
    navigate('/calendar');
  };
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground">
              {unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[350px]">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          {unreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-xs h-7"
              onClick={handleMarkAllAsRead}
            >
              Mark all as read
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup className="max-h-[300px] overflow-y-auto">
          {notifications.length > 0 ? (
            notifications.map(notification => (
              <DropdownMenuItem key={notification.id} className="p-0 focus:bg-transparent">
                <NotificationItem 
                  notification={notification} 
                  onMarkAsRead={handleMarkAsRead}
                />
              </DropdownMenuItem>
            ))
          ) : (
            <div className="py-4 text-center text-sm text-muted-foreground">
              No notifications
            </div>
          )}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <div className="p-2 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={handleViewAll}>
            View all
          </Button>
          <Button variant="ghost" size="sm" onClick={handleViewCalendar}>
            View Calendar
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default NotificationsDropdown;
