
import { FilterX, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface EventsFilterBarProps {
  searchQuery: string;
  typeFilter: string;
  formatFilter: string;
  onSearchChange: (value: string) => void;
  onTypeFilterChange: (value: string) => void;
  onFormatFilterChange: (value: string) => void;
  onClearFilters: () => void;
}

export function EventsFilterBar({
  searchQuery,
  typeFilter,
  formatFilter,
  onSearchChange,
  onTypeFilterChange,
  onFormatFilterChange,
  onClearFilters
}: EventsFilterBarProps) {
  const hasActiveFilters = searchQuery || typeFilter !== 'all' || formatFilter !== 'all';

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search events..." 
            className="pl-10"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        <Select value={typeFilter} onValueChange={onTypeFilterChange}>
          <SelectTrigger className="w-full md:w-[180px]">
            <SelectValue placeholder="Event Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="workshop">Workshops</SelectItem>
            <SelectItem value="webinar">Webinars</SelectItem>
            <SelectItem value="conference">Conferences</SelectItem>
            <SelectItem value="meetup">Meetups</SelectItem>
            <SelectItem value="hackathon">Hackathons</SelectItem>
          </SelectContent>
        </Select>
        <Select value={formatFilter} onValueChange={onFormatFilterChange}>
          <SelectTrigger className="w-full md:w-[180px]">
            <SelectValue placeholder="Format" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Formats</SelectItem>
            <SelectItem value="in-person">In-Person</SelectItem>
            <SelectItem value="virtual">Virtual</SelectItem>
            <SelectItem value="hybrid">Hybrid</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      {hasActiveFilters && (
        <div className="flex justify-end">
          <Button 
            variant="ghost" 
            className="h-8 px-2 lg:px-3" 
            onClick={onClearFilters}
          >
            <FilterX className="mr-2 h-4 w-4" />
            Clear filters
          </Button>
        </div>
      )}
    </div>
  );
}
