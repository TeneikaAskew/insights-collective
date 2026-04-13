// ABOUTME: Notifications dropdown in the header showing real notifications from the database
// ABOUTME: Fetches from the notifications table, supports marking as read and navigation

import { useState, useEffect } from 'react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';

interface DbNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  link: string | null;
  created_at: string;
}

const NotificationsDropdown = () => {
  const [notifications, setNotifications] = useState<DbNotification[]>([]);
  const navigate = useNavigate();
  const { user } = useAuth();
  
  useEffect(() => {
    if (!user) return;

    const fetchNotifications = async () => {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);
      setNotifications(data || []);
    };

    fetchNotifications();

    // Subscribe to real-time notifications
    const channel = supabase
      .channel('notifications-realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        setNotifications(prev => [payload.new as DbNotification, ...prev].slice(0, 10));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const unreadCount = notifications.filter(n => !n.is_read).length;
  
  const handleMarkAsRead = async (id: string) => {
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, is_read: true } : n)
    );
  };
  
  const handleMarkAllAsRead = async () => {
    if (!user) return;
    const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
    if (unreadIds.length === 0) return;
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .in('id', unreadIds);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };
  
  const handleViewAll = () => {
    navigate('/notifications');
  };
  
  const handleViewCalendar = () => {
    navigate('/calendar');
  };

  const handleNotificationClick = (notification: DbNotification) => {
    if (!notification.is_read) handleMarkAsRead(notification.id);
    if (notification.link) navigate(notification.link);
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
              <DropdownMenuItem 
                key={notification.id} 
                className={`p-3 cursor-pointer ${!notification.is_read ? 'bg-accent/50' : ''}`}
                onClick={() => handleNotificationClick(notification)}
              >
                <div className="flex flex-col gap-1 w-full">
                  <div className="flex justify-between items-start">
                    <span className="font-medium text-sm">{notification.title}</span>
                    {!notification.is_read && (
                      <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-1" />
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground line-clamp-2">{notification.message}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                  </span>
                </div>
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
