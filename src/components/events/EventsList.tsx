
import React from 'react';
import { Card } from '@/components/ui/card';
import { EventCard } from '@/components/events/EventCard';
import { NoEventsMessage } from '@/components/events/NoEventsMessage';
import { formatDate } from '@/lib/utils';

// Define the Event type with optional location to match usage
export interface Event {
  id: string;
  title: string;
  description: string;
  type: string;
  format: string;
  location?: string; // Make location optional
  link: string;
  date: string;
  startTime: string;
  endTime: string;
  image: string;
  capacity: number;
  registrations: number;
  calendlyLink: string;
}

interface EventsListProps {
  events: Event[];
  isLoading?: boolean;
  onRegister?: (eventId: string) => void;
  registeredEvents?: string[];
  isPast?: boolean; // Added missing prop
}

export const EventsList: React.FC<EventsListProps> = ({
  events,
  isLoading = false,
  onRegister = () => {},
  registeredEvents = [],
  isPast = false
}) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, index) => (
          <Card key={index} className="p-6 h-80 animate-pulse">
            <div className="h-40 bg-muted rounded-md mb-4"></div>
            <div className="h-6 bg-muted rounded-md mb-2 w-3/4"></div>
            <div className="h-4 bg-muted rounded-md mb-1 w-1/2"></div>
            <div className="h-4 bg-muted rounded-md mb-4 w-1/3"></div>
            <div className="h-10 bg-muted rounded-md w-full mt-auto"></div>
          </Card>
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return <NoEventsMessage isSearching={true} />;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {events.map((event) => (
        <EventCard
          key={event.id}
          event={{
            ...event,
            location: event.location || 'Online', // Provide default for optional location
          }}
          isRegistered={registeredEvents.includes(event.id)}
          onRegister={() => onRegister(event.id)}
          formattedDate={formatDate(event.date)}
          isPast={isPast}
        />
      ))}
    </div>
  );
};
