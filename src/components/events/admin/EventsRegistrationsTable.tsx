
import { format } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface Event {
  id: string;
  title: string;
}

interface Attendee {
  id: string;
  eventId: string;
  name: string;
  email: string;
  registrationDate: string;
}

interface EventsRegistrationsTableProps {
  attendees: Attendee[];
  events: Event[];
}

export function EventsRegistrationsTable({ attendees, events }: EventsRegistrationsTableProps) {
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM d, yyyy');
    } catch (error) {
      return dateString;
    }
  };

  return (
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
          {attendees.length > 0 ? (
            attendees.map((attendee) => {
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
  );
}
