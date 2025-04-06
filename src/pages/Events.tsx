
import { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { EventCard } from '@/components/events/EventCard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Mock events data
const mockEvents = [
  {
    id: '1',
    title: 'Data Science Workshop',
    description: 'Learn the fundamentals of data science, from data preprocessing to model deployment.',
    type: 'workshop',
    format: 'in-person',
    location: 'San Francisco Tech Hub',
    link: null,
    date: '2025-05-15',
    startTime: '09:00',
    endTime: '17:00',
    image: 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=MnwxfDB8MXxyYW5kb218MHx8fHx8fHx8MTY4MTY5ODY2OA&ixlib=rb-4.0.3&q=80&utm_campaign=api-credit&utm_medium=referral&utm_source=unsplash_source&w=1080',
    capacity: 50,
    registrations: 32,
  },
  {
    id: '2',
    title: 'Machine Learning Conference 2025',
    description: 'Join leading experts in machine learning for talks, workshops, and networking opportunities.',
    type: 'conference',
    format: 'hybrid',
    location: 'New York Convention Center',
    link: 'https://example.com/ml-conference',
    date: '2025-06-10',
    startTime: '08:30',
    endTime: '18:00',
    image: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=MnwxfDB8MXxyYW5kb218MHx8fHx8fHx8MTY4MTY5ODc2OQ&ixlib=rb-4.0.3&q=80&utm_campaign=api-credit&utm_medium=referral&utm_source=unsplash_source&w=1080',
    capacity: 300,
    registrations: 178,
  },
  {
    id: '3',
    title: 'Python for Data Analysis Webinar',
    description: 'A comprehensive online workshop covering pandas, numpy, and data visualization with Python.',
    type: 'webinar',
    format: 'virtual',
    location: null,
    link: 'https://example.com/python-webinar',
    date: '2025-05-20',
    startTime: '14:00',
    endTime: '16:00',
    image: 'https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=MnwxfDB8MXxyYW5kb218MHx8fHx8fHx8MTY4MTY5ODcwNw&ixlib=rb-4.0.3&q=80&utm_campaign=api-credit&utm_medium=referral&utm_source=unsplash_source&w=1080',
    capacity: null,
    registrations: 215,
  },
  {
    id: '4',
    title: 'AI Ethics Meetup',
    description: 'A discussion group focused on ethical considerations in artificial intelligence development and deployment.',
    type: 'meetup',
    format: 'in-person',
    location: 'Boston Innovation Hub',
    link: null,
    date: '2025-05-25',
    startTime: '18:00',
    endTime: '20:00',
    image: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=MnwxfDB8MXxyYW5kb218MHx8fHx8fHx8MTY4MTY5ODg3Ng&ixlib=rb-4.0.3&q=80&utm_campaign=api-credit&utm_medium=referral&utm_source=unsplash_source&w=1080',
    capacity: 30,
    registrations: 24,
  },
  {
    id: '5',
    title: 'Data Visualization Hackathon',
    description: '48-hour competition to create the most innovative and informative data visualizations from public datasets.',
    type: 'hackathon',
    format: 'hybrid',
    location: 'Seattle Tech Campus',
    link: 'https://example.com/dataviz-hackathon',
    date: '2025-07-15',
    startTime: '09:00',
    endTime: null,
    image: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=MnwxfDB8MXxyYW5kb218MHx8fHx8fHx8MTY4MTY5ODc2OQ&ixlib=rb-4.0.3&q=80&utm_campaign=api-credit&utm_medium=referral&utm_source=unsplash_source&w=1080',
    capacity: 100,
    registrations: 72,
  },
];

export default function Events() {
  const [events, setEvents] = useState(mockEvents);
  const [searchQuery, setSearchQuery] = useState('');
  const [formatFilter, setFormatFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const { toast } = useToast();
  
  useEffect(() => {
    // In a real app, this would fetch events from an API
    setEvents(mockEvents);
  }, []);
  
  const handleRegister = (eventId: string, userData?: any) => {
    console.log('Registering for event:', eventId, userData);
    
    // Update the registration count
    setEvents(events.map(event => 
      event.id === eventId 
        ? { ...event, registrations: event.registrations + 1 } 
        : event
    ));
  };
  
  const filteredEvents = events.filter(event => {
    const matchesSearch = 
      event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesFormat = formatFilter === 'all' || event.format === formatFilter;
    const matchesType = typeFilter === 'all' || event.type === typeFilter;
    
    return matchesSearch && matchesFormat && matchesType;
  });
  
  // Sort events by date (upcoming first)
  const sortedEvents = [...filteredEvents].sort((a, b) => {
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });
  
  // Upcoming events (today or later)
  const today = new Date().toISOString().split('T')[0];
  const upcomingEvents = sortedEvents.filter(event => event.date >= today);
  
  // Past events
  const pastEvents = sortedEvents.filter(event => event.date < today);
  
  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Events</h1>
          <p className="text-muted-foreground mt-2">
            Join our community events, workshops, and conferences.
          </p>
        </div>
        
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search events..." 
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full md:w-[180px]">
              <SelectValue placeholder="Event Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="workshop">Workshops</SelectItem>
              <SelectItem value="webinar">Webinars</SelectItem>
              <SelectItem value="conference">Conferences</SelectItem>
              <SelectItem value="meetup">Meetups</SelectItem>
              <SelectItem value="hackathon">Hackathons</SelectItem>
            </SelectContent>
          </Select>
          <Select value={formatFilter} onValueChange={setFormatFilter}>
            <SelectTrigger className="w-full md:w-[180px]">
              <SelectValue placeholder="Format" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Formats</SelectItem>
              <SelectItem value="in-person">In-Person</SelectItem>
              <SelectItem value="virtual">Virtual</SelectItem>
              <SelectItem value="hybrid">Hybrid</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <Tabs defaultValue="upcoming" className="space-y-8">
          <TabsList>
            <TabsTrigger value="upcoming" className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              <span>Upcoming Events ({upcomingEvents.length})</span>
            </TabsTrigger>
            <TabsTrigger value="past">Past Events ({pastEvents.length})</TabsTrigger>
          </TabsList>
          
          <TabsContent value="upcoming" className="space-y-6">
            {upcomingEvents.length > 0 ? (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {upcomingEvents.map((event) => (
                  <EventCard key={event.id} event={event} onRegister={handleRegister} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Calendar className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-medium">No upcoming events</h3>
                <p className="mt-2 text-muted-foreground">
                  Check back later for new events or adjust your search criteria.
                </p>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="past" className="space-y-6">
            {pastEvents.length > 0 ? (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {pastEvents.map((event) => (
                  <div key={event.id} className="opacity-70">
                    <EventCard event={event} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <h3 className="text-lg font-medium">No past events</h3>
                <p className="text-muted-foreground">
                  There are no past events matching your criteria.
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
