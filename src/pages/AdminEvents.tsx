import { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { AddEventModal } from '@/components/events/AddEventModal';
import { ViewRegistrationsModal } from '@/components/events/ViewRegistrationsModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Edit, Trash2, Calendar, Users, FilterX } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle, 
  AlertDialogTrigger 
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

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

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM d, yyyy');
    } catch (error) {
      return dateString;
    }
  };

  const today = new Date().toISOString().split('T')[0];
  const upcomingEvents = filteredEvents.filter(event => event.date >= today);
  const pastEvents = filteredEvents.filter(event => event.date < today);

  const eventAttendees = attendees.filter(attendee => 
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
                  
                  {(searchQuery || typeFilter !== 'all' || formatFilter !== 'all') && (
                    <div className="flex justify-end">
                      <Button 
                        variant="ghost" 
                        className="h-8 px-2 lg:px-3" 
                        onClick={clearFilters}
                      >
                        <FilterX className="mr-2 h-4 w-4" />
                        Clear filters
                      </Button>
                    </div>
                  )}

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
                      <div className="rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Event</TableHead>
                              <TableHead>Type</TableHead>
                              <TableHead>Date</TableHead>
                              <TableHead>Registrations</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {upcomingEvents.length > 0 ? (
                              upcomingEvents.map((event) => (
                                <TableRow key={event.id}>
                                  <TableCell className="font-medium">
                                    <div className="flex flex-col">
                                      {event.title}
                                      <span className="text-sm text-muted-foreground truncate max-w-[300px]">
                                        {event.description}
                                      </span>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex flex-col gap-1">
                                      <Badge variant="outline" className="capitalize bg-orange-100 text-orange-800">
                                        {event.type}
                                      </Badge>
                                      <Badge variant="secondary" className="capitalize bg-purple-100 text-purple-800">
                                        {event.format}
                                      </Badge>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center">
                                      <Calendar className="h-4 w-4 mr-1 text-muted-foreground" />
                                      {formatDate(event.date)}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center">
                                      <Users className="h-4 w-4 mr-1 text-muted-foreground" />
                                      {event.registrations} {event.capacity ? `/ ${event.capacity}` : ''}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" className="h-8 w-8 p-0">
                                          <span className="sr-only">Open menu</span>
                                          <svg 
                                            xmlns="http://www.w3.org/2000/svg" 
                                            width="24" 
                                            height="24" 
                                            viewBox="0 0 24 24" 
                                            fill="none" 
                                            stroke="currentColor" 
                                            strokeWidth="2" 
                                            strokeLinecap="round" 
                                            strokeLinejoin="round" 
                                            className="h-4 w-4"
                                          >
                                            <circle cx="12" cy="12" r="1" />
                                            <circle cx="12" cy="5" r="1" />
                                            <circle cx="12" cy="19" r="1" />
                                          </svg>
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={() => handleEditEvent(event)}>
                                          <Edit className="mr-2 h-4 w-4" />
                                          Edit
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                          <ViewRegistrationsModal
                                            eventId={event.id}
                                            eventTitle={event.title}
                                            attendees={attendees}
                                          >
                                            <div className="flex items-center w-full">
                                              <Users className="mr-2 h-4 w-4" />
                                              View Registrations
                                            </div>
                                          </ViewRegistrationsModal>
                                        </DropdownMenuItem>
                                        <AlertDialog>
                                          <AlertDialogTrigger asChild>
                                            <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:text-destructive">
                                              <Trash2 className="mr-2 h-4 w-4" />
                                              Delete
                                            </DropdownMenuItem>
                                          </AlertDialogTrigger>
                                          <AlertDialogContent>
                                            <AlertDialogHeader>
                                              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                              <AlertDialogDescription>
                                                This will permanently delete the event "{event.title}" and all its registrations. This action cannot be undone.
                                              </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                                              <AlertDialogAction 
                                                onClick={() => handleDeleteEvent(event.id)}
                                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                              >
                                                Delete
                                              </AlertDialogAction>
                                            </AlertDialogFooter>
                                          </AlertDialogContent>
                                        </AlertDialog>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </TableCell>
                                </TableRow>
                              ))
                            ) : (
                              <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center">
                                  No upcoming events found.
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </TabsContent>

                    <TabsContent value="past">
                      <div className="rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Event</TableHead>
                              <TableHead>Type</TableHead>
                              <TableHead>Date</TableHead>
                              <TableHead>Registrations</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {pastEvents.length > 0 ? (
                              pastEvents.map((event) => (
                                <TableRow key={event.id}>
                                  <TableCell className="font-medium">
                                    <div className="flex flex-col">
                                      {event.title}
                                      <span className="text-sm text-muted-foreground truncate max-w-[300px]">
                                        {event.description}
                                      </span>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex flex-col gap-1">
                                      <Badge variant="outline" className="capitalize bg-orange-100 text-orange-800">
                                        {event.type}
                                      </Badge>
                                      <Badge variant="secondary" className="capitalize bg-purple-100 text-purple-800">
                                        {event.format}
                                      </Badge>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center">
                                      <Calendar className="h-4 w-4 mr-1 text-muted-foreground" />
                                      {formatDate(event.date)}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center">
                                      <Users className="h-4 w-4 mr-1 text-muted-foreground" />
                                      {event.registrations} {event.capacity ? `/ ${event.capacity}` : ''}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" className="h-8 w-8 p-0">
                                          <span className="sr-only">Open menu</span>
                                          <svg 
                                            xmlns="http://www3.org/2000/svg" 
                                            width="24" 
                                            height="24" 
                                            viewBox="0 0 24 24" 
                                            fill="none" 
                                            stroke="currentColor" 
                                            strokeWidth="2" 
                                            strokeLinecap="round" 
                                            strokeLinejoin="round" 
                                            className="h-4 w-4"
                                          >
                                            <circle cx="12" cy="12" r="1" />
                                            <circle cx="12" cy="5" r="1" />
                                            <circle cx="12" cy="19" r="1" />
                                          </svg>
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                          <ViewRegistrationsModal
                                            eventId={event.id}
                                            eventTitle={event.title}
                                            attendees={attendees}
                                          >
                                            <div className="flex items-center w-full">
                                              <Users className="mr-2 h-4 w-4" />
                                              View Registrations
                                            </div>
                                          </ViewRegistrationsModal>
                                        </DropdownMenuItem>
                                        <AlertDialog>
                                          <AlertDialogTrigger asChild>
                                            <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:text-destructive">
                                              <Trash2 className="mr-2 h-4 w-4" />
                                              Delete
                                            </DropdownMenuItem>
                                          </AlertDialogTrigger>
                                          <AlertDialogContent>
                                            <AlertDialogHeader>
                                              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                              <AlertDialogDescription>
                                                This will permanently delete the event "{event.title}" and all its registrations. This action cannot be undone.
                                              </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                                              <AlertDialogAction 
                                                onClick={() => handleDeleteEvent(event.id)}
                                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                              >
                                                Delete
                                              </AlertDialogAction>
                                            </AlertDialogFooter>
                                          </AlertDialogContent>
                                        </AlertDialog>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </TableCell>
                                </TableRow>
                              ))
                            ) : (
                              <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center">
                                  No past events found.
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>
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
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Event</TableHead>
                        <TableHead>Registration Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {eventAttendees.length > 0 ? (
                        eventAttendees.map((attendee) => {
                          const event = events.find(e => e.id === attendee.eventId);
                          return (
                            <TableRow key={attendee.id}>
                              <TableCell className="font-medium">{attendee.name}</TableCell>
                              <TableCell>{attendee.email}</TableCell>
                              <TableCell>
                                {event ? (
                                  <div className="flex items-center">
                                    <span>{event.title}</span>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">Unknown Event</span>
                                )}
                              </TableCell>
                              <TableCell>{formatDate(attendee.registrationDate)}</TableCell>
                            </TableRow>
                          );
                        })
                      ) : (
                        <TableRow>
                          <TableCell colSpan={4} className="h-24 text-center">
                            No registrations found.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
