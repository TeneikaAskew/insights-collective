
import { useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface EventsFilterProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  typeFilter: string;
  setTypeFilter: (type: string) => void;
  formatFilter: string;
  setFormatFilter: (format: string) => void;
}

export function EventsFilter({
  searchQuery,
  setSearchQuery,
  typeFilter,
  setTypeFilter,
  formatFilter,
  setFormatFilter
}: EventsFilterProps) {
  return (
    <div className="flex flex-col md:flex-row gap-4">
      <div className="flex-1 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Search events..." 
          className="pl-10"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>
      <Select value={typeFilter} onValueChange={setTypeFilter}>
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
      <Select value={formatFilter} onValueChange={setFormatFilter}>
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
  );
}
