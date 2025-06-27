import { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { EventsHeader } from '@/components/events/EventsHeader';
import { EventsFilter } from '@/components/events/EventsFilter';
import { EventsList } from '@/components/events/EventsList';
import { NoEventsMessage } from '@/components/events/NoEventsMessage';
import { useAuth } from '@/contexts/AuthContext';
import { useEventsWithRegistrations } from '@/hooks/useEventsWithRegistrations';
import { 
  useRegisterForEvent, 
  useUnregisterFromEvent
} from '@/hooks/useEventRegistrations';
import { Skeleton } from '@/components/ui/skeleton';

export default function Events() {
  const { user } = useAuth();
  const { data, isLoading } = useEventsWithRegistrations();
  const registerMutation = useRegisterForEvent();
  const unregisterMutation = useUnregisterFromEvent();
  
  // Extract data from the combined query
  const events = data?.events || [];
  const registeredEventIds = data?.registeredEventIds || [];
  
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [formatFilter, setFormatFilter] = useState('all');
  const { toast } = useToast();
  
  const handleRegister = async (eventId: string) => {
    if (!user) {
      toast({
        title: 'Login Required',
        description: 'Please login to register for events.',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      // Don't allow registration if already registered
      if (registeredEventIds.includes(eventId)) {
        return;
      }
      
      const result = await registerMutation.mutateAsync(eventId);
      if (result.already_registered) {
        toast({
          title: 'Already Registered',
          description: 'You are already registered for this event.',
        });
      } else {
        toast({
          title: 'Registration Successful',
          description: 'You have been registered for this event.',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to register for event.',
        variant: 'destructive',
      });
    }
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
  
  const isSearching = searchQuery !== '' || typeFilter !== 'all' || formatFilter !== 'all';
  
  // Show loading state while data is being fetched
  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-8">
          <EventsHeader />
          <div className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-64 w-full" />
              ))}
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }
  
  return (
    <AppLayout>
      <div className="space-y-8">
        <EventsHeader />
        
        <EventsFilter 
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          typeFilter={typeFilter}
          setTypeFilter={setTypeFilter}
          formatFilter={formatFilter}
          setFormatFilter={setFormatFilter}
        />
        
        <Tabs defaultValue="upcoming" className="space-y-8">
          <TabsList>
            <TabsTrigger value="upcoming" className="flex items-center gap-1 data-[state=active]:bg-insightBlue data-[state=active]:text-white">
              <Calendar className="h-4 w-4" />
              <span>Upcoming Events ({upcomingEvents.length})</span>
            </TabsTrigger>
            <TabsTrigger value="past" className="data-[state=active]:bg-insightBlue data-[state=active]:text-white">
              Past Events ({pastEvents.length})
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="upcoming" className="space-y-6">
            {upcomingEvents.length > 0 ? (
              <EventsList 
                events={upcomingEvents} 
                onRegister={handleRegister} 
                registeredEvents={registeredEventIds}
                isRegistering={registerMutation.isPending}
              />
            ) : (
              <NoEventsMessage isSearching={isSearching} />
            )}
          </TabsContent>
          
          <TabsContent value="past" className="space-y-6">
            {pastEvents.length > 0 ? (
              <EventsList 
                events={pastEvents} 
                isPast={true} 
                registeredEvents={registeredEventIds}
              />
            ) : (
              <NoEventsMessage isSearching={isSearching} isPast={true} />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}