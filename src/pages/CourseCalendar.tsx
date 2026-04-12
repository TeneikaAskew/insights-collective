import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { CourseLayout } from '@/components/course/CourseLayout';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Toggle } from '@/components/ui/toggle';
import { Button } from '@/components/ui/button';
import { 
  Calendar as CalendarIcon, 
  GraduationCap, 
  BookOpen, 
  FileText,
  ClipboardList,
  Clock,
  MapPin,
  Plus,
  Filter
} from 'lucide-react';
import { useCourseCalendar, useCalendarEventMutations } from '@/hooks/useCourseCalendar';
import { CourseCalendarEvent } from '@/types/course';
import { format, isAfter, isBefore, isToday, isSameDay, startOfMonth, endOfMonth } from 'date-fns';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useCoursePermissions } from '@/hooks/useCoursePermissions';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useNavigate } from 'react-router-dom';

const CourseCalendar = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { canEdit } = useCoursePermissions(courseId);
  
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [selectedEvent, setSelectedEvent] = useState<CourseCalendarEvent | null>(null);
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'agenda'>('month');
  const [activeFilters, setActiveFilters] = useState({
    assignment: true,
    quiz: true,
    event: true,
  });

  // Fetch calendar events using the new service
  const filterTypes = Object.entries(activeFilters)
    .filter(([_, enabled]) => enabled)
    .map(([type, _]) => type);

  const { events = [], isLoading } = useCourseCalendar(courseId, {
    types: filterTypes,
    startDate: date ? startOfMonth(date) : undefined,
    endDate: date ? endOfMonth(date) : undefined,
  });

  const toggleFilter = (filter: keyof typeof activeFilters) => {
    setActiveFilters(prev => ({
      ...prev,
      [filter]: !prev[filter]
    }));
  };

  // Filter events based on active filters
  const filteredEvents = events.filter(event => 
    activeFilters[event.type as keyof typeof activeFilters]
  );

  // Get events for selected date
  const eventsForSelectedDate = filteredEvents.filter(event => {
    if (!date) return false;
    return isSameDay(new Date(event.start_date), date);
  });

  // Get upcoming events
  const upcomingEvents = filteredEvents
    .filter(event => isAfter(new Date(event.start_date), new Date()))
    .slice(0, 10);

  // Check if a date has events
  const getDatesWithEvents = (checkDate: Date): boolean => {
    return filteredEvents.some(event => 
      isSameDay(new Date(event.start_date), checkDate)
    );
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'assignment':
        return <FileText className="h-4 w-4" />;
      case 'quiz':
        return <ClipboardList className="h-4 w-4" />;
      default:
        return <CalendarIcon className="h-4 w-4" />;
    }
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case 'assignment':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'quiz':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const handleEventClick = (event: CourseCalendarEvent) => {
    if (event.type === 'assignment' && event.related_id) {
      // Navigate to assignment detail
      // You'll need to determine the module ID for proper navigation
      navigate(`/courses/${courseId}/assignments/${event.related_id}`);
    } else if (event.type === 'quiz' && event.related_id) {
      // Navigate to quiz
      navigate(`/courses/${courseId}/quizzes/${event.related_id}`);
    } else {
      setSelectedEvent(event);
    }
  };

  if (isLoading) {
    return (
      <CourseLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Skeleton className="h-96 lg:col-span-2" />
            <Skeleton className="h-96" />
          </div>
        </div>
      </CourseLayout>
    );
  }

  return (
    <CourseLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Course Calendar</h1>
          {canEdit && (
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Event
            </Button>
          )}
        </div>

        <div className="flex gap-2 items-center">
          <span className="text-sm font-medium">Show:</span>
          <Toggle
            pressed={activeFilters.assignment}
            onPressedChange={() => toggleFilter('assignment')}
            size="sm"
          >
            <FileText className="h-4 w-4 mr-1" />
            Assignments
          </Toggle>
          <Toggle
            pressed={activeFilters.quiz}
            onPressedChange={() => toggleFilter('quiz')}
            size="sm"
          >
            <ClipboardList className="h-4 w-4 mr-1" />
            Quizzes
          </Toggle>
          <Toggle
            pressed={activeFilters.event}
            onPressedChange={() => toggleFilter('event')}
            size="sm"
          >
            <CalendarIcon className="h-4 w-4 mr-1" />
            Events
          </Toggle>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar View */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Calendar View</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-center">
              <Calendar
                mode="single"
                selected={date}
                onSelect={setDate}
                className="rounded-md border"
                modifiers={{
                  hasEvent: (date) => getDatesWithEvents(date),
                }}
                modifiersStyles={{
                  hasEvent: {
                    fontWeight: 'bold',
                    textDecoration: 'underline',
                  },
                }}
              />
              </div>

              {date && eventsForSelectedDate.length > 0 && (
                <div className="mt-6 space-y-3">
                  <h3 className="font-semibold text-sm">
                    Events on {format(date, 'MMMM d, yyyy')}
                  </h3>
                  {eventsForSelectedDate.map(event => (
                    <div
                      key={event.id}
                      className={cn(
                        "p-3 rounded-lg border cursor-pointer hover:shadow-md transition-shadow",
                        getEventColor(event.type)
                      )}
                      onClick={() => handleEventClick(event)}
                    >
                      <div className="flex items-start gap-2">
                        {getEventIcon(event.type)}
                        <div className="flex-1">
                          <p className="font-medium text-sm">{event.title}</p>
                          {event.description && (
                            <p className="text-xs mt-1 opacity-75">
                              {event.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Upcoming Events */}
          <Card>
            <CardHeader>
              <CardTitle>Upcoming Events</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {upcomingEvents.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No upcoming events
                  </p>
                ) : (
                  upcomingEvents.map(event => {
                    const eventDate = new Date(event.start_date);
                    const isEventToday = isToday(eventDate);
                    
                    return (
                      <div
                        key={event.id}
                        className={cn(
                          "p-3 rounded-lg border cursor-pointer hover:shadow-md transition-shadow",
                          isEventToday && "ring-2 ring-primary",
                          getEventColor(event.type)
                        )}
                        onClick={() => handleEventClick(event)}
                      >
                        <div className="flex items-start gap-2">
                          {getEventIcon(event.type)}
                          <div className="flex-1">
                            <p className="font-medium text-sm">{event.title}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Clock className="h-3 w-3" />
                              <span className="text-xs">
                                {format(eventDate, 'MMM d, yyyy')}
                              </span>
                            </div>
                            {event.description && (
                              <p className="text-xs mt-1 opacity-75">
                                {event.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Event Detail Dialog */}
        <Dialog open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{selectedEvent?.title}</DialogTitle>
              <DialogDescription>
                {selectedEvent && format(new Date(selectedEvent.start_date), 'MMMM d, yyyy')}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {selectedEvent?.description && (
                <p className="text-sm">{selectedEvent.description}</p>
              )}
              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  {selectedEvent?.type}
                </Badge>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </CourseLayout>
  );
};

export default CourseCalendar;