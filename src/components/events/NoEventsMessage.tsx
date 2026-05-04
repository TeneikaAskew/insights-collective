
import { Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface NoEventsMessageProps {
  isSearching?: boolean;
  isPast?: boolean;
  onClearFilters?: () => void;
}

export function NoEventsMessage({ isSearching = false, isPast = false, onClearFilters }: NoEventsMessageProps) {
  let heading: string;
  let description: string;

  if (isSearching) {
    heading = 'No events match your search';
    description = 'Try adjusting your filters or clearing the search query.';
  } else if (isPast) {
    heading = 'No past events';
    description = 'Events you attend will appear here.';
  } else {
    heading = 'No upcoming events yet';
    description = 'Check back soon — new events are added regularly.';
  }

  return (
    <div className="text-center py-16 px-4">
      <Calendar className="mx-auto h-10 w-10 text-muted-foreground/50 mb-4" />
      <h3 className="text-lg font-medium">{heading}</h3>
      <p className="mt-2 text-sm text-muted-foreground max-w-xs mx-auto">{description}</p>
      {isSearching && onClearFilters && (
        <Button variant="outline" size="sm" onClick={onClearFilters} className="mt-4">
          Clear Filters
        </Button>
      )}
    </div>
  );
}
