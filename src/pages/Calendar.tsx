
import { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Toggle } from '@/components/ui/toggle';
import { Calendar as CalendarIcon, GraduationCap, BookOpen, FileText, Clock } from 'lucide-react';
import { useUserCalendar } from '@/hooks/useCourseCalendar';
import { useAuth } from '@/hooks/use-auth';
import { format, isSameDay, isAfter } from 'date-fns';
import { Link } from 'react-router-dom';

const CalendarPage = () => {
  const { user } = useAuth();
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [activeFilters, setActiveFilters] = useState({
    quiz: true,
    assignment: true,
    event: true,
    announcement: true
  });
  
  // Fetch user's calendar events
  const filterTypes = Object.entries(activeFilters)
    .filter(([_, enabled]) => enabled)
    .map(([type, _]) => type);

  const { events = [], isLoading } = useUserCalendar(user?.id, {
    types: filterTypes,
  });
  
  const toggleFilter = (filter: keyof typeof activeFilters) => {
    setActiveFilters(prev => ({
      ...prev,
      [filter]: !prev[filter]
    }));
  };
  
  // Filter events based on selected date
  const eventsForSelectedDate = events.filter(event => {
    return date && isSameDay(new Date(event.start_date), date);
  });
  
  // Get all upcoming events (filtered)
  const upcomingEvents = events
    .filter(event => isAfter(new Date(event.start_date), new Date()))
    .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());
  
  // Function to get date with events
  const getDatesWithEvents = (checkDate: Date): boolean => {
    return events.some(event => 
      isSameDay(new Date(event.start_date), checkDate)
    );
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case 'assignment': return 'bg-blue-100 text-blue-800';
      case 'quiz': return 'bg-purple-100 text-purple-800';
      case 'event': return 'bg-green-100 text-green-800';
      case 'announcement': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getNavigationUrl = (event: any) => {
    if (event.type === 'assignment' && event.related_id) {
      return `/courses/${event.course_id}/assignments/${event.related_id}`;
    }
    if (event.type === 'quiz' && event.related_id) {
      return `/courses/${event.course_id}/quizzes/${event.related_id}`;
    }
    return `/courses/${event.course_id}/calendar`;
  };
  
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Calendar</h1>
          <p className="text-muted-foreground">
            View and manage your upcoming events, assignments, and deadlines.
          </p>
        </div>
        
        <div className="flex gap-4 flex-wrap">
          <Toggle 
            pressed={activeFilters.quiz} 
            onPressedChange={() => toggleFilter('quiz')}
            className="data-[state=on]:bg-primary/20"
          >
            <BookOpen className="h-4 w-4 mr-2" />
            Quizzes & Exams
          </Toggle>
          <Toggle 
            pressed={activeFilters.assignment} 
            onPressedChange={() => toggleFilter('assignment')}
            className="data-[state=on]:bg-primary/20"
          >
            <FileText className="h-4 w-4 mr-2" />
            Assignments
          </Toggle>
          <Toggle 
            pressed={activeFilters.event} 
            onPressedChange={() => toggleFilter('event')}
            className="data-[state=on]:bg-primary/20"
          >
            <GraduationCap className="h-4 w-4 mr-2" />
            Events
          </Toggle>
          <Toggle 
            pressed={activeFilters.announcement} 
            onPressedChange={() => toggleFilter('announcement')}
            className="data-[state=on]:bg-primary/20"
          >
            <CalendarIcon className="h-4 w-4 mr-2" />
            Announcements
          </Toggle>
        </div>
        
        <div className="grid gap-6 md:grid-cols-[350px_1fr]">
          <div>
            <Card>
              <CardContent className="p-0">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  className="w-full"
                  modifiers={{
                    hasEvent: getDatesWithEvents
                  }}
                  modifiersClassNames={{
                    hasEvent: "bg-primary/20 rounded-full"
                  }}
                />
              </CardContent>
            </Card>
          </div>
          
          <div>
            <Tabs defaultValue="selectedDay">
              <TabsList>
                <TabsTrigger value="selectedDay">Selected Day</TabsTrigger>
                <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
              </TabsList>
              <TabsContent value="selectedDay" className="space-y-4 mt-4">
                <h2 className="text-xl font-medium">
                  {date ? date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : 'Select a date'}
                </h2>
                
                {isLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                      <Card key={i}>
                        <CardContent className="p-4">
                          <div className="animate-pulse">
                            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : eventsForSelectedDate.length > 0 ? (
                  <div className="space-y-3">
                    {eventsForSelectedDate.map(event => (
                      <Link key={event.id} to={getNavigationUrl(event)}>
                        <Card className="hover:shadow-md transition-shadow">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <h3 className="font-medium">{event.title}</h3>
                                <p className="text-sm text-muted-foreground">{event.course_title}</p>
                                {event.description && (
                                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">{event.description}</p>
                                )}
                                <div className="flex items-center gap-2 mt-2">
                                  <Clock className="h-3 w-3 text-gray-400" />
                                  <span className="text-xs text-gray-500">
                                    {format(new Date(event.start_date), 'h:mm a')}
                                  </span>
                                </div>
                              </div>
                              <Badge className={getEventColor(event.type)}>
                                {event.type}
                              </Badge>
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No events scheduled for this day.</p>
                )}
              </TabsContent>
              
              <TabsContent value="upcoming" className="space-y-4 mt-4">
                <h2 className="text-xl font-medium">Upcoming Events</h2>
                
                {isLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map(i => (
                      <Card key={i}>
                        <CardContent className="p-4">
                          <div className="animate-pulse">
                            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                            <div className="h-3 bg-gray-200 rounded w-1/2 mb-2"></div>
                            <div className="h-3 bg-gray-200 rounded w-1/3"></div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : upcomingEvents.length > 0 ? (
                  <div className="space-y-3">
                    {upcomingEvents.slice(0, 10).map(event => (
                      <Link key={event.id} to={getNavigationUrl(event)}>
                        <Card className="hover:shadow-md transition-shadow">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <h3 className="font-medium">{event.title}</h3>
                                <p className="text-sm text-muted-foreground">{event.course_title}</p>
                                {event.description && (
                                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">{event.description}</p>
                                )}
                                <div className="flex items-center text-sm text-muted-foreground mt-2">
                                  <CalendarIcon className="h-3 w-3 mr-1" />
                                  {format(new Date(event.start_date), 'EEE, MMM d')}
                                  <Clock className="h-3 w-3 ml-2 mr-1" />
                                  {format(new Date(event.start_date), 'h:mm a')}
                                </div>
                              </div>
                              <Badge className={getEventColor(event.type)}>
                                {event.type}
                              </Badge>
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No upcoming events.</p>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default CalendarPage;
