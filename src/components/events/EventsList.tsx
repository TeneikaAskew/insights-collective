
import { EventCard } from '@/components/events/EventCard';

interface Event {
  id: string;
  title: string;
  description: string;
  type: string;
  format: string;
  location?: string | null;
  link?: string | null;
  date: string;
  startTime?: string;
  endTime?: string;
  image?: string;
  capacity?: number | null;
  registrations: number;
  calendlyLink?: string;
}

interface EventsListProps {
  events: Event[];
  isPast?: boolean;
  onRegister?: (eventId: string) => void;
  registeredEvents?: string[]; // Add registered events array
  isRegistering?: boolean;
}

export function EventsList({ events, isPast = false, onRegister, registeredEvents = [], isRegistering = false }: EventsListProps) {
  if (events.length === 0) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium">No {isPast ? 'past' : 'upcoming'} events</h3>
        <p className="text-muted-foreground">
          There are no {isPast ? 'past' : 'upcoming'} events matching your criteria.
        </p>
      </div>
    );
  }
  
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {events.map((event) => (
        <div key={event.id} className={isPast ? "opacity-70" : ""}>
          <EventCard 
            event={event} 
            onRegister={!isPast ? onRegister : undefined} 
            isRegistered={registeredEvents.includes(event.id)}
            isRegistering={isRegistering}
          />
        </div>
      ))}
    </div>
  );
}
