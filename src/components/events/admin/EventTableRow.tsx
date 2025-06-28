
import { format } from 'date-fns';
import { Calendar, Users } from 'lucide-react';
import { TableCell, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { EventTableActions } from './EventTableActions';

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

interface Attendee {
  id: string;
  eventId: string;
  name: string;
  email: string;
  registrationDate: string;
}

interface EventTableRowProps {
  event: Event;
  attendees: Attendee[];
  isPast?: boolean;
  onEditEvent: (event: Event) => void;
  onDeleteEvent: (id: string) => void;
}

export function EventTableRow({
  event,
  attendees,
  isPast = false,
  onEditEvent,
  onDeleteEvent
}: EventTableRowProps) {
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM d, yyyy');
    } catch (error) {
      return dateString;
    }
  };

  return (
    <TableRow>
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
          <Badge variant="outline" className="capitalize bg-primary/10 text-primary">
            {event.type}
          </Badge>
          <Badge variant="secondary" className="capitalize bg-accent/10 text-accent-foreground">
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
        <EventTableActions 
          event={event}
          attendees={attendees}
          isPast={isPast}
          onEditEvent={onEditEvent}
          onDeleteEvent={onDeleteEvent}
        />
      </TableCell>
    </TableRow>
  );
}
