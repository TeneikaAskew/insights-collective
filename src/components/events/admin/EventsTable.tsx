
import { format } from 'date-fns';
import { Calendar, Edit, Trash2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ViewRegistrationsModal } from '@/components/events/ViewRegistrationsModal';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

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
                      {!isPast && (
                        <DropdownMenuItem onClick={() => onEditEvent(event)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                      )}
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
                      <DropdownMenuItem 
                        onSelect={(e) => e.preventDefault()} 
                        className="text-destructive focus:text-destructive"
                      >
                        <ConfirmationDialog
                          trigger={
                            <div className="flex items-center w-full">
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </div>
                          }
                          title="Are you sure?"
                          description={`This will permanently delete the event "${event.title}" and all its registrations. This action cannot be undone.`}
                          confirmLabel="Delete"
                          onConfirm={() => onDeleteEvent(event.id)}
                          destructive={true}
                        />
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
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
