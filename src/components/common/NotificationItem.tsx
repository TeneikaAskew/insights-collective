
import { Notification } from '@/types';
import { Bell, FileText, MessageSquare, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { resolveNotificationLink } from '@/lib/notificationLink';
import { Link } from 'react-router-dom';

interface NotificationItemProps {
  notification: Notification & { courseId?: string | null };
  onMarkAsRead?: (id: string) => void;
}

const NotificationItem = ({ notification, onMarkAsRead }: NotificationItemProps) => {
  const formattedDate = new Date(notification.createdAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  
  const getIcon = () => {
    switch (notification.type) {
      case 'assignment':
        return <FileText className="h-5 w-5 text-ss-teal" />;
      case 'quiz':
        return <CheckCircle className="h-5 w-5 text-ss-good" />;
      case 'announcement':
        return <Bell className="h-5 w-5 text-ss-warn" />;
      case 'feedback':
        return <MessageSquare className="h-5 w-5 text-primary" />;
      default:
        return <Bell className="h-5 w-5 text-primary" />;
    }
  };
  
  const handleClick = () => {
    if (!notification.isRead && onMarkAsRead) {
      onMarkAsRead(notification.id);
    }
  };

  // Older rows carry no `link` at all. `to={link || '#'}` turned those into a
  // link that navigated nowhere, and — because the row is only marked read on
  // click — clicking one left it unread too, so it read as a dead row.
  const destination = resolveNotificationLink({
    type: notification.type,
    link: notification.link,
    courseId: notification.courseId,
  });

  // Header row then body row, matching /notifications. Holding the message in
  // the same column as the title meant it shared that column's width with a
  // timestamp and an unread dot, so on a phone it wrapped in a strip roughly
  // half the row wide while the space under the icon sat empty.
  const body = (
    <>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0">{getIcon()}</div>

        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm break-words">{notification.title}</h4>
          <span className="text-xs text-muted-foreground">{formattedDate}</span>
        </div>

        {!notification.isRead && (
          <div className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />
        )}
      </div>

      <p className="mt-2 text-sm text-muted-foreground line-clamp-3">{notification.message}</p>
    </>
  );

  const className = cn(
    "block w-full text-left p-3 rounded-lg hover:bg-secondary transition-colors",
    !notification.isRead && "bg-secondary/50"
  );

  // Nowhere to navigate: still a control, because clicking it marks it read.
  // A <button> rather than an <a> so it does not advertise a destination it
  // does not have.
  if (!destination) {
    return (
      <button type="button" className={className} onClick={handleClick}>
        {body}
      </button>
    );
  }

  return (
    <Link to={destination} className={className} onClick={handleClick}>
      {body}
    </Link>
  );
};

export default NotificationItem;
