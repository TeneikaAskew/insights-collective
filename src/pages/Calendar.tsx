
import { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Toggle } from '@/components/ui/toggle';
import { Calendar as CalendarIcon, GraduationCap, BookOpen, FileText } from 'lucide-react';

// Mock calendar events
const mockEvents = [
  {
    id: '1',
    title: 'Data Science Quiz',
    date: new Date(2025, 3, 10), // April 10, 2025
    type: 'quiz',
    courseId: 'course1',
    courseName: 'Introduction to Data Science'
  },
  {
    id: '2',
    title: 'Machine Learning Assignment Due',
    date: new Date(2025, 3, 15), // April 15, 2025
    type: 'assignment',
    courseId: 'course2',
    courseName: 'Advanced Machine Learning'
  },
  {
    id: '3',
    title: 'Data Engineering Live Session',
    date: new Date(2025, 3, 18), // April 18, 2025
    type: 'event',
    courseId: 'course3',
    courseName: 'Data Engineering Fundamentals'
  },
  {
    id: '4',
    title: 'Business Intelligence Project Deadline',
    date: new Date(2025, 3, 20), // April 20, 2025
    type: 'assignment',
    courseId: 'course4',
    courseName: 'Business Intelligence with Power BI'
  },
  {
    id: '5',
    title: 'NLP Course Final Exam',
    date: new Date(2025, 3, 25), // April 25, 2025
    type: 'quiz',
    courseId: 'course5',
    courseName: 'Natural Language Processing'
  }
];

const CalendarPage = () => {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [activeFilters, setActiveFilters] = useState({
    quiz: true,
    assignment: true,
    event: true
  });
  
  const toggleFilter = (filter: keyof typeof activeFilters) => {
    setActiveFilters(prev => ({
      ...prev,
      [filter]: !prev[filter]
    }));
  };
  
  // Filter events based on selected date and active filters
  const eventsForSelectedDate = mockEvents.filter(event => {
    const isSameDay = date && 
      event.date.getDate() === date.getDate() &&
      event.date.getMonth() === date.getMonth() &&
      event.date.getFullYear() === date.getFullYear();
    
    return isSameDay && activeFilters[event.type as keyof typeof activeFilters];
  });
  
  // Get all upcoming events (filtered)
  const upcomingEvents = mockEvents
    .filter(event => {
      const isUpcoming = event.date >= new Date();
      return isUpcoming && activeFilters[event.type as keyof typeof activeFilters];
    })
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  
  // Function to get date with events - corrected to return boolean
  const getDatesWithEvents = (date: Date): boolean => {
    return mockEvents.some(event => 
      event.date.getDate() === date.getDate() &&
      event.date.getMonth() === date.getMonth() &&
      event.date.getFullYear() === date.getFullYear()
    );
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
            Live Sessions
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
                
                {eventsForSelectedDate.length > 0 ? (
                  <div className="space-y-3">
                    {eventsForSelectedDate.map(event => (
                      <Card key={event.id}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <h3 className="font-medium">{event.title}</h3>
                              <p className="text-sm text-muted-foreground">{event.courseName}</p>
                            </div>
                            <Badge>
                              {event.type === 'quiz' ? 'Quiz' : 
                               event.type === 'assignment' ? 'Assignment' : 'Live Session'}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No events scheduled for this day.</p>
                )}
              </TabsContent>
              
              <TabsContent value="upcoming" className="space-y-4 mt-4">
                <h2 className="text-xl font-medium">Upcoming Events</h2>
                
                {upcomingEvents.length > 0 ? (
                  <div className="space-y-3">
                    {upcomingEvents.slice(0, 5).map(event => (
                      <Card key={event.id}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <h3 className="font-medium">{event.title}</h3>
                              <p className="text-sm text-muted-foreground">{event.courseName}</p>
                              <div className="flex items-center text-sm text-muted-foreground mt-1">
                                <CalendarIcon className="h-3 w-3 mr-1" />
                                {event.date.toLocaleDateString('en-US', { 
                                  weekday: 'short',
                                  month: 'short', 
                                  day: 'numeric'
                                })}
                              </div>
                            </div>
                            <Badge>
                              {event.type === 'quiz' ? 'Quiz' : 
                               event.type === 'assignment' ? 'Assignment' : 'Live Session'}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
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
