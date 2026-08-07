import { useState } from 'react';
import { AddEventModal } from '@/components/events/modals/AddEventModal';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { EventsTable } from '@/components/events/admin/EventsTable';
import { EventsFilterBar } from '@/components/events/admin/EventsFilterBar';
import { EventsRegistrationsTable } from '@/components/events/admin/EventsRegistrationsTable';
import { Plus, Loader2 } from 'lucide-react';
import { useEvents, useCreateEvent, useUpdateEvent, useDeleteEvent, type Event } from '@/hooks/useEvents';
import { useEventRegistrations } from '@/hooks/useEventRegistrations';
import { Skeleton } from '@/components/ui/skeleton';

export default function AdminEvents() {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [formatFilter, setFormatFilter] = useState('all');
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const [eventToEdit, setEventToEdit] = useState<Event | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const { toast } = useToast();
  
  // Fetch events from Supabase
  const {
    data: events = [],
    isLoading: eventsLoading,
    isError: eventsError,
    error: eventsErrorDetail,
    refetch: refetchEvents,
  } = useEvents();
  const {
    data: registrations = [],
    isLoading: registrationsLoading,
    isError: registrationsError,
    error: registrationsErrorDetail,
    refetch: refetchRegistrations,
  } = useEventRegistrations();
  const createEvent = useCreateEvent();
  const updateEvent = useUpdateEvent();
  const deleteEvent = useDeleteEvent();
  
  // Transform registrations data for the table
  const attendees = registrations.map(reg => ({
    id: reg.id,
    eventId: reg.event_id,
    name: [reg.profiles?.first_name, reg.profiles?.last_name].filter(Boolean).join(' ') || 'Unknown',
    // Email lives in auth.users, not in the public profiles table, so it is
    // not available from this query. Render a dash, not fake data.
    email: '—',
    registrationDate: reg.registered_at
      ? new Date(reg.registered_at).toISOString().split('T')[0]
      : '—'
  }));

  const handleAddEvent = async (newEvent: Omit<Event, 'id' | 'created_at' | 'updated_at'> & { id?: string }) => {
    try {
      const isEditing = eventToEdit !== null;
      
      if (isEditing && newEvent.id) {
        await updateEvent.mutateAsync({
          id: newEvent.id,
          ...newEvent
        });
        toast({
          title: 'Event Updated',
          description: 'The event has been successfully updated.',
        });
      } else {
        const { id, ...eventData } = newEvent;
        const finalEventData = {
          ...eventData,
          link: eventData.link || null,
          image: eventData.image || null,
          start_time: eventData.start_time || null,
          end_time: eventData.end_time || null,
          location: eventData.location || null,
          capacity: eventData.capacity || null,
          calendly_link: eventData.calendly_link || null
        };
        await createEvent.mutateAsync(finalEventData);
        toast({
          title: 'Event Added',
          description: 'The event has been successfully added to the calendar.',
        });
      }
      setEventToEdit(null);
      setIsModalOpen(false);
    } catch (error) {
      toast({
        title: 'Error',
        description: eventToEdit ? 'Failed to update event' : 'Failed to create event',
        variant: 'destructive',
      });
    }
  };

  const handleEditEvent = (event: any) => {
    setEventToEdit(event);
    setIsModalOpen(true);
  };

  const handleDeleteEvent = async (id: string) => {
    try {
      await deleteEvent.mutateAsync(id);
      toast({
        title: 'Event Deleted',
        description: 'The event has been successfully removed from the calendar.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete event',
        variant: 'destructive',
      });
    }
  };

  const filteredEvents = events.filter((event) => {
    const matchesSearch = 
      event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesType = typeFilter === 'all' || event.type === typeFilter;
    const matchesFormat = formatFilter === 'all' || event.format === formatFilter;
    
    return matchesSearch && matchesType && matchesFormat;
  });
  
  // Add registration counts to events
  const eventsWithCounts = filteredEvents.map(event => {
    const registrationCount = registrations.filter(reg => reg.event_id === event.id).length;
    return {
      ...event,
      registrations: registrationCount,
      startTime: event.start_time,
      endTime: event.end_time,
      calendlyLink: event.calendly_link
    };
  });

  const today = new Date().toISOString().split('T')[0];
  const upcomingEvents = eventsWithCounts.filter(event => event.date >= today);
  const pastEvents = eventsWithCounts.filter(event => event.date < today);

  const filteredAttendees = attendees.filter(attendee => 
    selectedEvent ? attendee.eventId === selectedEvent : true
  );

  const clearFilters = () => {
    setSearchQuery('');
    setTypeFilter('all');
    setFormatFilter('all');
  };

  return (
    <div className="space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Manage Events</h1>
            <p className="text-muted-foreground mt-2">
              Create, update, and track events and registrations.
            </p>
          </div>
          <Button 
            onClick={() => { setEventToEdit(null); setIsModalOpen(true); }} 
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
            disabled={eventsLoading}
          >
            {eventsLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )} 
            Add Event
          </Button>
        </div>

        <AddEventModal
          key={eventToEdit?.id ?? 'new'}
          open={isModalOpen}
          onAddEvent={handleAddEvent} 
          editEvent={eventToEdit} 
          onClose={() => { 
            setIsModalOpen(false); 
            setEventToEdit(null);
          }}
        />

        <Tabs defaultValue="events" className="space-y-8">
          <TabsList>
            <TabsTrigger value="events" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Events</TabsTrigger>
            <TabsTrigger value="registrations" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Registrations</TabsTrigger>
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
                {eventsLoading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                  </div>
                ) : eventsError ? (
                  <div className="py-8 text-center" role="alert">
                    <p className="text-destructive font-medium mb-1">Failed to load events</p>
                    <p className="text-sm text-muted-foreground mb-4">
                      {eventsErrorDetail instanceof Error ? eventsErrorDetail.message : 'Please try again.'}
                    </p>
                    <Button variant="outline" size="sm" onClick={() => refetchEvents()}>
                      Retry
                    </Button>
                  </div>
                ) : (
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
                    <TabsList>
                      <TabsTrigger 
                        value="upcoming"
                        className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                      >
                        Upcoming Events ({upcomingEvents.length})
                      </TabsTrigger>
                      <TabsTrigger 
                        value="past"
                        className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
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
                )}
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
                  <Select
                    value={selectedEvent || 'all'}
                    onValueChange={(value) => setSelectedEvent(value === 'all' ? null : value)}
                  >
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
                {registrationsLoading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-20 w-full" />
                  </div>
                ) : registrationsError ? (
                  <div className="py-8 text-center" role="alert">
                    <p className="text-destructive font-medium mb-1">Failed to load registrations</p>
                    <p className="text-sm text-muted-foreground mb-4">
                      {registrationsErrorDetail instanceof Error
                        ? registrationsErrorDetail.message
                        : 'Please try again.'}
                    </p>
                    <Button variant="outline" size="sm" onClick={() => refetchRegistrations()}>
                      Retry
                    </Button>
                  </div>
                ) : (
                  <EventsRegistrationsTable
                    attendees={filteredAttendees}
                    events={events}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
    </div>
  );
}