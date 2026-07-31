import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock, ExternalLink, FileText, BarChart3, Megaphone, Pin } from 'lucide-react';
import { useUpcomingEvents, useCalendarStats } from '@/hooks/useCourseCalendar';
import { CourseCalendarEvent } from '@/types/course';
import { formatDistanceToNow, format, isToday, isTomorrow, isYesterday } from 'date-fns';
import { Link } from 'react-router-dom';

interface CalendarWidgetProps {
  courseId: string;
  days?: number;
  showStats?: boolean;
  maxEvents?: number;
  variant?: 'compact' | 'full';
}

export const CalendarWidget: React.FC<CalendarWidgetProps> = ({
  courseId,
  days = 7,
  showStats = true,
  maxEvents = 5,
  variant = 'compact',
}) => {
  const { events, isLoading } = useUpcomingEvents(courseId, days);
  const { stats } = useCalendarStats(courseId);
  const [currentPage, setCurrentPage] = useState(0);

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'assignment':
        return FileText;
      case 'quiz':
        return BarChart3;
      case 'announcement':
        return Megaphone;
      case 'event':
        return CalendarIcon;
      default:
        return Pin;
    }
  };

  const getEventColor = (event: CourseCalendarEvent) => {
    const eventDate = new Date(event.start_date);
    const now = new Date();
    
    // Overdue items
    if (eventDate < now && (event.title.includes('Due') || event.title.includes('Closes'))) {
      return 'bg-ss-bad-chip text-ss-bad border-ss-bad';
    }
    
    // Due today
    if (isToday(eventDate)) {
      return 'bg-ss-warn-chip text-ss-warn border-ss-warn';
    }
    
    // Due tomorrow
    if (isTomorrow(eventDate)) {
      return 'bg-ss-warn-chip text-ss-warn border-ss-warn';
    }
    
    // Future events
    return 'bg-ss-teal-chip text-ss-teal border-ss-teal';
  };

  const formatEventDate = (dateString: string) => {
    const date = new Date(dateString);
    
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    if (isYesterday(date)) return 'Yesterday';
    
    return format(date, 'MMM d');
  };

  const getNavigationUrl = (event: CourseCalendarEvent) => {
    if (event.type === 'assignment' && event.related_id) {
      return `/courses/${courseId}/assignments/${event.related_id}`;
    }
    if (event.type === 'quiz' && event.related_id) {
      return `/courses/${courseId}/quizzes/${event.related_id}`;
    }
    return `/courses/${courseId}/calendar`;
  };

  const paginatedEvents = events?.slice(currentPage * maxEvents, (currentPage + 1) * maxEvents) || [];
  const totalPages = Math.ceil((events?.length || 0) / maxEvents);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
            <div className="h-4 bg-muted rounded w-2/3"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarIcon className="h-4 w-4" />
            Upcoming Events
          </CardTitle>
          <Link to={`/courses/${courseId}/calendar`}>
            <Button variant="ghost" size="sm">
              <ExternalLink className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showStats && stats && variant === 'full' && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="text-center p-2 bg-ss-teal-chip rounded-lg">
              <div className="text-lg font-bold text-ss-teal">{stats.upcoming_assignments}</div>
              <div className="text-xs text-ss-teal">Assignments</div>
            </div>
            <div className="text-center p-2 bg-ss-lav-chip rounded-lg">
              <div className="text-lg font-bold text-ss-lav-deep">{stats.upcoming_quizzes}</div>
              <div className="text-xs text-ss-lav-deep">Quizzes</div>
            </div>
            <div className="text-center p-2 bg-ss-good-chip rounded-lg">
              <div className="text-lg font-bold text-ss-good">{stats.total_events}</div>
              <div className="text-xs text-ss-good">Total Events</div>
            </div>
            <div className="text-center p-2 bg-ss-bad-chip rounded-lg">
              <div className="text-lg font-bold text-ss-bad">{stats.overdue_items}</div>
              <div className="text-xs text-ss-bad">Overdue</div>
            </div>
          </div>
        )}

        {!events || events.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <CalendarIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No upcoming events</p>
          </div>
        ) : (
          <div className="space-y-2">
            {paginatedEvents.map((event) => (
              <Link
                key={event.id}
                to={getNavigationUrl(event)}
                className="block hover:bg-accent rounded-lg transition-colors"
              >
                <div className={`p-3 rounded-lg border ${getEventColor(event)}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {(() => { const EIcon = getEventIcon(event.type); return <EIcon className="h-4 w-4" />; })()}
                        <span className="font-medium text-sm line-clamp-1">
                          {event.title.replace(/^[\p{Extended_Pictographic}\u2600-\u27BF] /u, '').trim()}
                        </span>
                      </div>
                      {event.description && variant === 'full' && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                          {event.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {event.type}
                        </Badge>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatEventDate(event.start_date)}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(event.start_date), { addSuffix: true })}
                      </div>
                      {event.location && variant === 'full' && (
                        <div className="text-xs text-muted-foreground mt-1">{event.location}</div>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            ))}

            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                  disabled={currentPage === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs text-muted-foreground">
                  {currentPage + 1} of {totalPages}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
                  disabled={currentPage === totalPages - 1}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        )}

        {showStats && stats && stats.overdue_items > 0 && (
          <div className="mt-4 p-3 bg-ss-bad-chip border border-ss-bad rounded-lg">
            <div className="flex items-center gap-2 text-ss-bad">
              <Clock className="h-4 w-4" />
              <span className="text-sm font-medium">
                {stats.overdue_items} overdue item{stats.overdue_items !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};