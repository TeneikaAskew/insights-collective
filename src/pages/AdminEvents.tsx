import { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { AddEventModal } from '@/components/events/AddEventModal';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { EventsTable } from '@/components/events/admin/EventsTable';
import { EventsFilterBar } from '@/components/events/admin/EventsFilterBar';
import { EventsRegistrationsTable } from '@/components/events/admin/EventsRegistrationsTable';

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
    calendlyLink: 'https://calendly.com/insightscollective/data-science-workshop',
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
    calendlyLink: 'https://calendly.com/insightscollective/ml-conference',
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
    calendlyLink: 'https://calendly.com/insightscollective/python-webinar',
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
    calendlyLink: 'https://calendly.com/insightscollective/ai-ethics-meetup',
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
    calendlyLink: 'https://calendly.com/insightscollective/data-visualization-hackathon',
  },
];

const mockAttendees = [
  { id: '1', eventId: '1', name: 'John Doe', email: 'john.doe@example.com', registrationDate: '2025-04-01' },
  { id: '2', eventId: '1', name: 'Jane Smith', email: 'jane.smith@example.com', registrationDate: '2025-04-02' },
  { id: '3', eventId: '2', name: 'Alice Johnson', email: 'alice@example.com', registrationDate: '2025-04-01' },
  { id: '4', eventId: '2', name: 'Bob Brown', email: 'bob@example.com', registrationDate: '2025-04-03' },
  { id: '5', eventId: '3', name: 'Carol White', email: 'carol@example.com', registrationDate: '2025-04-02' },
  { id: '6', eventId: '3', name: 'Dave Green', email: 'dave@example.com', registrationDate: '2025-04-04' },
  { id: '7', eventId: '4', name: 'Eve Black', email: 'eve@example.com', registrationDate: '2025-04-05' },
  { id: '8', eventId: '5', name: 'Frank Yellow', email: 'frank@example.com', registrationDate: '2025-04-06' },
];

export default function AdminEvents() {
  const [events, setEvents] = useState(mockEvents);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [formatFilter, setFormatFilter] = useState('all');
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const [attendees, setAttendees] = useState(mockAttendees);
  const [eventToEdit, setEventToEdit] = useState<any>(null);
  
  const { toast } = useToast();

  const handleAddEvent = (newEvent: any) => {
    const isEditing = events.some(e => e.id === newEvent.id);
    
    if (isEditing) {
      setEvents(events.map(event => 
        event.id === newEvent.id ? newEvent : event
      ));
      toast({
        title: 'Event Updated',
        description: 'The event has been successfully updated.',
      });
    } else {
      setEvents([...events, newEvent]);
      toast({
        title: 'Event Added',
        description: 'The event has been successfully added to the calendar.',
      });
    }
    setEventToEdit(null);
  };

  const handleEditEvent = (event: any) => {
    setEventToEdit(event);
  };

  const handleDeleteEvent = (id: string) => {
    setEvents(events.filter(event => event.id !== id));
    setAttendees(attendees.filter(attendee => attendee.eventId !== id));
    toast({
      title: 'Event Deleted',
      description: 'The event has been successfully removed from the calendar.',
    });
  };

  const filteredEvents = events.filter((event) => {
    const matchesSearch = 
      event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesType = typeFilter === 'all' || event.type === typeFilter;
    const matchesFormat = formatFilter === 'all' || event.format === formatFilter;
    
    return matchesSearch && matchesType && matchesFormat;
  });

  const today = new Date().toISOString().split('T')[0];
  const upcomingEvents = filteredEvents.filter(event => event.date >= today);
  const pastEvents = filteredEvents.filter(event => event.date < today);

  const filteredAttendees = attendees.filter(attendee => 
    selectedEvent ? attendee.eventId === selectedEvent : true
  );

  const clearFilters = () => {
    setSearchQuery('');
    setTypeFilter('all');
    setFormatFilter('all');
  };

  return (
    <AppLayout>
      <div className="space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Manage Events</h1>
            <p className="text-muted-foreground mt-2">
              Create, update, and track events and registrations.
            </p>
          </div>
          <AddEventModal onAddEvent={handleAddEvent} />
        </div>

        {eventToEdit && (
          <AddEventModal 
            onAddEvent={handleAddEvent} 
            editEvent={eventToEdit} 
            children={<Button onClick={() => handleEditEvent(eventToEdit)}>Edit Event</Button>}
          />
        )}

        <Tabs defaultValue="events" className="space-y-8">
          <TabsList className="bg-orange-100">
            <TabsTrigger value="events" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white">Events</TabsTrigger>
            <TabsTrigger value="registrations" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white">Registrations</TabsTrigger>
          </TabsList>

          <TabsContent value="events" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Event Calendar</CardTitle>
                <CardDescription>
                  Manage upcoming and past events.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <EventsFilterBar 
                    searchQuery={searchQuery}
                    typeFilter={typeFilter}
                    formatFilter={formatFilter}
                    onSearchChange={setSearchQuery}
                    onTypeFilterChange={setTypeFilter}
                    onFormatFilterChange={setFormatFilter}
                    onClearFilters={clearFilters}
                  />

                  <Tabs defaultValue="upcoming" className="space-y-4">
                    <TabsList className="bg-purple-100">
                      <TabsTrigger 
                        value="upcoming"
                        className="data-[state=active]:bg-purple-600 data-[state=active]:text-white"
                      >
                        Upcoming Events ({upcomingEvents.length})
                      </TabsTrigger>
                      <TabsTrigger 
                        value="past"
                        className="data-[state=active]:bg-purple-600 data-[state=active]:text-white"
                      >
                        Past Events ({pastEvents.length})
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="upcoming">
                      <EventsTable 
                        events={upcomingEvents} 
                        attendees={attendees}
                        onEditEvent={handleEditEvent}
                        onDeleteEvent={handleDeleteEvent}
                      />
                    </TabsContent>

                    <TabsContent value="past">
                      <EventsTable 
                        events={pastEvents} 
                        attendees={attendees}
                        isPast={true}
                        onEditEvent={handleEditEvent}
                        onDeleteEvent={handleDeleteEvent}
                      />
                    </TabsContent>
                  </Tabs>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="registrations" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Event Registrations</CardTitle>
                    <CardDescription>
                      View and manage attendee registrations.
                    </CardDescription>
                  </div>
                  <Select value={selectedEvent || 'all'} onValueChange={setSelectedEvent}>
                    <SelectTrigger className="w-[220px]">
                      <SelectValue placeholder="Filter by event" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Events</SelectItem>
                      {events.map((event) => (
                        <SelectItem key={event.id} value={event.id}>
                          {event.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <EventsRegistrationsTable 
                  attendees={filteredAttendees} 
                  events={events} 
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
