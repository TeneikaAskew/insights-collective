
import { Calendar } from 'lucide-react';

interface NoEventsMessageProps {
  isSearching: boolean;
}

export function NoEventsMessage({ isSearching }: NoEventsMessageProps) {
  return (
    <div className="text-center py-12">
      <Calendar className="mx-auto h-12 w-12 text-muted-foreground" />
      <h3 className="mt-4 text-lg font-medium">No upcoming events</h3>
      <p className="mt-2 text-muted-foreground">
        {isSearching 
          ? 'Check back later for new events or adjust your search criteria.'
          : 'Check back later for new events.'}
      </p>
    </div>
  );
}
