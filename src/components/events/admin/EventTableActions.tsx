
import { Edit, Trash2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
}

interface Attendee {
  id: string;
  eventId: string;
  name: string;
  email: string;
  registrationDate: string;
}

interface EventTableActionsProps {
  event: Event;
  attendees: Attendee[];
  isPast?: boolean;
  onEditEvent: (event: Event) => void;
  onDeleteEvent: (id: string) => void;
}

export function EventTableActions({
  event,
  attendees,
  isPast = false,
  onEditEvent,
  onDeleteEvent
}: EventTableActionsProps) {
  // Get attendees for this specific event only
  const eventAttendees = attendees.filter(attendee => attendee.eventId === event.id);
  
  return (
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
            attendees={eventAttendees}
          >
            <div className="flex items-center w-full">
              <Users className="mr-2 h-4 w-4" />
              View Registrations ({eventAttendees.length})
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
  );
}
