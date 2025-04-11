
import { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { EventsHeader } from '@/components/events/EventsHeader';
import { EventsFilter } from '@/components/events/EventsFilter';
import { EventsList } from '@/components/events/EventsList';
import { NoEventsMessage } from '@/components/events/NoEventsMessage';
import { useAuth } from '@/contexts/AuthContext';
import { getRegisteredEvents, registerForEvent, isRegisteredForEvent } from '@/utils/idUtils';
import { supabase } from '@/integrations/supabase/client';

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

export default function Events() {
  const [events, setEvents] = useState(mockEvents);
  const [searchQuery, setSearchQuery] = useState('');
  const [formatFilter, setFormatFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [registeredEvents, setRegisteredEvents] = useState<string[]>([]);
  const { toast } = useToast();
  const { isAuthenticated, user } = useAuth();
  
  // Load user's registered events from localStorage on component mount
  useEffect(() => {
    setRegisteredEvents(getRegisteredEvents());
    
    // In a real app with Supabase, we would fetch the user's registered events
    const fetchRegisteredEvents = async () => {
      if (isAuthenticated && user) {
        try {
          const { data, error } = await supabase
            .from('event_registrations')
            .select('event_id')
            .eq('user_id', user.id);
            
          if (!error && data) {
            // Combine Supabase registrations with localStorage ones
            const supabaseRegistrations = data.map(item => item.event_id);
            const localRegistrations = getRegisteredEvents();
            
            // Combine and remove duplicates
            const combinedRegistrations = [...new Set([...supabaseRegistrations, ...localRegistrations])];
            setRegisteredEvents(combinedRegistrations);
          }
        } catch (error) {
          console.error('Error fetching registered events:', error);
        }
      }
    };
    
    fetchRegisteredEvents();
  }, [isAuthenticated, user]);
  
  const handleRegister = (eventId: string, userData?: any) => {
    if (!isAuthenticated) {
      toast({
        title: "Authentication Required",
        description: "Please log in to register for this event.",
        variant: "default",
      });
      return;
    }
    
    console.log('Registering for event:', eventId, userData);
    
    // Update the registration count in the UI
    setEvents(events.map(event => 
      event.id === eventId 
        ? { ...event, registrations: event.registrations + 1 } 
        : event
    ));
    
    // Save registration in localStorage
    registerForEvent(eventId);
    
    // Update component state
    setRegisteredEvents(prev => [...prev, eventId]);
    
    // In a real app, we would also save to Supabase
    if (isAuthenticated && user) {
      const saveToSupabase = async () => {
        try {
          const { error } = await supabase
            .from('event_registrations')
            .insert({
              user_id: user.id,
              event_id: eventId
            });
            
          if (error) {
            console.error('Error saving event registration to Supabase:', error);
          }
        } catch (error) {
          console.error('Error in Supabase operation:', error);
        }
      };
      
      saveToSupabase();
    }
    
    toast({
      title: 'Registration Successful',
      description: 'You have been registered for this event.',
      variant: "default",
    });
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
          <TabsList className="bg-aquaTeal/10">
            <TabsTrigger value="upcoming" className="flex items-center gap-1 data-[state=active]:bg-insightBlue data-[state=active]:text-white">
              <Calendar className="h-4 w-4" />
              <span>Upcoming Events ({upcomingEvents.length})</span>
            </TabsTrigger>
            <TabsTrigger value="past" className="data-[state=active]:bg-insightBlue data-[state=active]:text-white">Past Events ({pastEvents.length})</TabsTrigger>
          </TabsList>
          
          <TabsContent value="upcoming" className="space-y-6">
            {upcomingEvents.length > 0 ? (
              <EventsList 
                events={upcomingEvents} 
                onRegister={handleRegister} 
                registeredEvents={registeredEvents}
              />
            ) : (
              <NoEventsMessage isSearching={isSearching} />
            )}
          </TabsContent>
          
          <TabsContent value="past" className="space-y-6">
            <EventsList 
              events={pastEvents} 
              isPast={true} 
              registeredEvents={registeredEvents}
            />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
