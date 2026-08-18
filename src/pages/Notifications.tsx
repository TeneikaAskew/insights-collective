// ABOUTME: In-app notification center. Reads from public.notifications, groups by course,
// ABOUTME: shows unread counts per course, supports mark-as-read + realtime updates.
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { Bell, CheckCheck, FileText, MessageSquare, Megaphone, Trash2, Inbox } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { resolveNotificationLink } from '@/lib/notificationLink';

interface DbNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  link: string | null;
  course_id: string | null;
  created_at: string;
}

interface CourseLite {
  id: string;
  title: string;
}

function iconFor(type: string) {
  switch (type) {
    case 'course_announcement':
      return <Megaphone className="h-4 w-4 text-ss-teal" />;
    case 'assignment_grade':
    case 'assignment_graded':
    case 'assignment_submitted':
    case 'assignment':
      return <FileText className="h-4 w-4 text-ss-lav-deep" />;
    case 'submission_feedback':
    case 'message':
      return <MessageSquare className="h-4 w-4 text-ss-good" />;
    default:
      return <Bell className="h-4 w-4 text-primary" />;
  }
}

const Notifications = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [items, setItems] = useState<DbNotification[]>([]);
  const [courses, setCourses] = useState<Record<string, CourseLite>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [activeFilter, setActiveFilter] = useState<string>('all');

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setIsLoading(false);
      return;
    }

    let alive = true;
    const load = async () => {
      setIsLoading(true);
      setLoadError(null);
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(200);
      if (!alive) return;
      if (error) {
        // A failed fetch must not render as "Nothing here" / "all caught up".
        setLoadError(error.message);
        setIsLoading(false);
        return;
      }
      const rows = (data ?? []) as DbNotification[];
      setItems(rows);

      const courseIds = Array.from(new Set(rows.map((r) => r.course_id).filter(Boolean))) as string[];
      if (courseIds.length) {
        const { data: courseRows, error: coursesError } = await supabase
          .from('courses')
          .select('id, title')
          .in('id', courseIds);
        if (!alive) return;
        if (!coursesError) {
          // Course titles are cosmetic labels; the tab falls back to "Course".
          const map: Record<string, CourseLite> = {};
          (courseRows ?? []).forEach((c: any) => (map[c.id] = c));
          setCourses(map);
        }
      }
      setIsLoading(false);
    };
    void load();

    const channel = supabase
      .channel('notifications-page')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        (payload) => {
          setItems((prev) => {
            if (payload.eventType === 'INSERT') {
              return [payload.new as DbNotification, ...prev];
            }
            if (payload.eventType === 'UPDATE') {
              return prev.map((n) =>
                n.id === (payload.new as DbNotification).id ? (payload.new as DbNotification) : n,
              );
            }
            if (payload.eventType === 'DELETE') {
              return prev.filter((n) => n.id !== (payload.old as DbNotification).id);
            }
            return prev;
          });
        },
      )
      .subscribe();

    return () => {
      alive = false;
      supabase.removeChannel(channel);
    };
    // reloadKey is a real dependency: the "Retry" button bumps it and that
    // must re-run the fetch, otherwise the error state is a dead end.
  }, [user, authLoading, reloadKey]);

  const perCourseCounts = useMemo(() => {
    const map = new Map<string, { total: number; unread: number }>();
    for (const n of items) {
      const key = n.course_id ?? '__none__';
      const b = map.get(key) ?? { total: 0, unread: 0 };
      b.total += 1;
      if (!n.is_read) b.unread += 1;
      map.set(key, b);
    }
    return map;
  }, [items]);

  const totalUnread = items.filter((n) => !n.is_read).length;

  // One entry per dropdown option, in the order they appear in the menu.
  const filterOptions = useMemo(() => {
    const general = perCourseCounts.get('__none__');
    const options: { value: string; label: string; badge: number; variant: 'secondary' | 'default' }[] = [
      { value: 'all', label: 'All', badge: items.length, variant: 'secondary' },
      { value: 'unread', label: 'Unread', badge: totalUnread, variant: 'default' },
    ];
    for (const [id, counts] of perCourseCounts.entries()) {
      if (id === '__none__') continue;
      options.push({
        value: id,
        label: courses[id]?.title ?? 'Course',
        badge: counts.unread,
        variant: 'default',
      });
    }
    if (general) {
      options.push({ value: 'general', label: 'General', badge: general.unread, variant: 'default' });
    }
    return options;
  }, [items.length, totalUnread, perCourseCounts, courses]);

  // A course option disappears once its last notification is deleted. Falling
  // back to "All" keeps the trigger from going blank over an empty list.
  useEffect(() => {
    if (!filterOptions.some((o) => o.value === activeFilter)) setActiveFilter('all');
  }, [filterOptions, activeFilter]);

  const activeOption = filterOptions.find((o) => o.value === activeFilter) ?? filterOptions[0];

  const filtered = useMemo(() => {
    if (activeFilter === 'all') return items;
    if (activeFilter === 'unread') return items.filter((n) => !n.is_read);
    if (activeFilter === 'general') return items.filter((n) => !n.course_id);
    return items.filter((n) => n.course_id === activeFilter);
  }, [items, activeFilter]);

  // Optimistic mutations below roll back on a failed write and surface a
  // destructive toast — the UI must never claim a write happened that didn't.
  const markAsRead = async (id: string) => {
    const previous = items;
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    if (error) {
      setItems(previous);
      toast({
        title: 'Failed to mark notification as read',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const markAllRead = async () => {
    if (!user) return;
    const ids = filtered.filter((n) => !n.is_read).map((n) => n.id);
    if (!ids.length) return;
    const previous = items;
    setItems((prev) => prev.map((n) => (ids.includes(n.id) ? { ...n, is_read: true } : n)));
    const { error } = await supabase.from('notifications').update({ is_read: true }).in('id', ids);
    if (error) {
      setItems(previous);
      toast({
        title: 'Failed to mark notifications as read',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const removeOne = async (id: string) => {
    const previous = items;
    // Deleting the last row under a course or General filter empties that
    // option, and the fallback effect above switches the selection to All.
    // Restoring only the rows would leave the user looking at All with their
    // notification back, so the filter is part of what rolls back.
    const previousFilter = activeFilter;
    setItems((prev) => prev.filter((n) => n.id !== id));
    const { error } = await supabase.from('notifications').delete().eq('id', id);
    if (error) {
      setItems(previous);
      setActiveFilter(previousFilter);
      toast({
        title: 'Failed to delete notification',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleClick = (n: DbNotification) => {
    if (!n.is_read) void markAsRead(n.id);
    // Rows written before the triggers set `link` have none; the type and
    // course still say where the row belongs, so a click is never a no-op.
    const destination = resolveNotificationLink(n);
    if (destination) navigate(destination);
  };

  if (!authLoading && !user) {
    return (
      <AppLayout>
        <div className="container mx-auto py-16 px-4 text-center">
          <Bell className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <h1 className="text-2xl font-semibold mb-2">Sign in to see your notifications</h1>
          <p className="text-muted-foreground mb-6">
            You'll get course announcements, assignment updates, and more here.
          </p>
          <Link to="/login">
            <Button>Log in</Button>
          </Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container mx-auto py-8 px-4 space-y-6 max-w-4xl">
        <div className="flex flex-wrap justify-between items-start gap-3">
          <div className="space-y-1 text-left">
            <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
            <p className="text-muted-foreground">
              {loadError
                ? 'Notifications are unavailable right now.'
                : totalUnread > 0
                  ? `${totalUnread} unread ${totalUnread === 1 ? 'notification' : 'notifications'}`
                  : "You're all caught up."}
            </p>
          </div>
          <Button variant="outline" onClick={markAllRead} disabled={!filtered.some((n) => !n.is_read)}>
            <CheckCheck className="h-4 w-4 mr-2" />
            Mark all as read
          </Button>
        </div>

        {/* One dropdown instead of a tab strip: the course list grows with
            enrollment, and a wrapping TabsList ate three rows of the page on a
            phone before any notification was visible. */}
        <div className="flex items-center gap-2">
          <Select value={activeFilter} onValueChange={setActiveFilter}>
            <SelectTrigger
              className="w-full sm:w-[300px] justify-between"
              aria-label="Filter notifications"
            >
              {/* `!flex` beats the trigger's own `[&>span]:line-clamp-1`, which
                  would otherwise turn this row into a -webkit-box and stack the
                  badge under the label. */}
              <span className="!flex items-center gap-2 min-w-0">
                <span className="truncate">{activeOption?.label ?? 'All'}</span>
                {activeOption && activeOption.badge > 0 && (
                  <Badge variant={activeOption.variant}>{activeOption.badge}</Badge>
                )}
              </span>
            </SelectTrigger>
            <SelectContent>
              {filterOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  <span className="flex items-center gap-2">
                    <span className="truncate">{option.label}</span>
                    {option.badge > 0 && <Badge variant={option.variant}>{option.badge}</Badge>}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="mt-4">
            {isLoading ? (
              <div className="py-16 text-center text-muted-foreground">
                <Bell className="h-6 w-6 mx-auto opacity-60 animate-spin" />
              </div>
            ) : loadError ? (
              <Card>
                <CardContent className="py-16 text-center" role="alert">
                  <Bell className="h-12 w-12 text-destructive/40 mx-auto mb-3" />
                  <h3 className="text-lg font-medium">Failed to load notifications</h3>
                  <p className="text-sm text-muted-foreground mb-4">{loadError}</p>
                  <Button variant="outline" onClick={() => setReloadKey((k) => k + 1)}>
                    Retry
                  </Button>
                </CardContent>
              </Card>
            ) : filtered.length === 0 ? (
              <Card>
                <CardContent className="py-16 text-center">
                  <Inbox className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
                  <h3 className="text-lg font-medium">Nothing here</h3>
                  <p className="text-sm text-muted-foreground">
                    New announcements and assignment updates will show up here.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {filtered.map((n) => (
                  <Card
                    key={n.id}
                    data-testid="notification-card"
                    // The row's identity. Notification titles and messages
                    // repeat heavily (an assignment-graded fan-out produces
                    // dozens of identical rows), so any test that needs to
                    // follow ONE row has to key on the id, not the text.
                    data-notification-id={n.id}
                    className={cn(
                      'transition-colors hover:bg-accent/40 cursor-pointer',
                      !n.is_read && 'border-l-4 border-l-primary bg-primary/5',
                    )}
                    onClick={() => handleClick(n)}
                  >
                    {/* Two rows, not three columns.
                        The message used to sit in the same narrow column as the
                        title, sharing that column's width with a timestamp and
                        a delete button — on a phone that left it about half the
                        card, so a two-line message wrapped to four and the
                        titles clipped to "Assignment gra…". Header row: icon,
                        title, delete. Body row: the message, spanning the card.
                        The timestamp joins the course name on the meta line,
                        which is where it stops competing for title width. */}
                    <CardContent className="p-4 text-left">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 shrink-0 p-2 rounded-full bg-muted">{iconFor(n.type)}</div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-semibold break-words">{n.title}</h4>
                          <p className="text-xs text-muted-foreground break-words">
                            {n.course_id && courses[n.course_id] && (
                              <span>{courses[n.course_id].title} · </span>
                            )}
                            {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            void removeOne(n.id);
                          }}
                          aria-label="Delete notification"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground line-clamp-3">{n.message}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
        </div>
      </div>
    </AppLayout>
  );
};

export default Notifications;
