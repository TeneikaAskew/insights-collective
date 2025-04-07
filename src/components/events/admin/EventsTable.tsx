
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EventTableRow } from './EventTableRow';

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

interface EventsTableProps {
  events: Event[];
  attendees: Attendee[];
  isPast?: boolean;
  onEditEvent: (event: Event) => void;
  onDeleteEvent: (id: string) => void;
}

export function EventsTable({ 
  events, 
  attendees, 
  isPast = false, 
  onEditEvent, 
  onDeleteEvent 
}: EventsTableProps) {
  return (
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
          {events.length > 0 ? (
            events.map((event) => (
              <EventTableRow
                key={event.id}
                event={event}
                attendees={attendees}
                isPast={isPast}
                onEditEvent={onEditEvent}
                onDeleteEvent={onDeleteEvent}
              />
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={5} className="h-24 text-center">
                No {isPast ? 'past' : 'upcoming'} events found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
