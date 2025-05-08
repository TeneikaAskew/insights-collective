
import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, FilterX } from 'lucide-react';

interface ResourceFiltersProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  categoryFilter: string;
  setCategoryFilter: (category: string) => void;
  typeFilter: string;
  setTypeFilter: (type: string) => void;
  withDeadline: boolean;
  setWithDeadline: (deadline: boolean) => void;
  uniqueCategories: string[];
  uniqueResourceTypes: string[];
  clearFilters: () => void;
  searchPlaceholder: string;
  showDeadlineFilter?: boolean; // Optional, as some tabs might not need it, though current design has it everywhere
}

export const ResourceFilters: React.FC<ResourceFiltersProps> = ({
  searchQuery,
  setSearchQuery,
  categoryFilter,
  setCategoryFilter,
  typeFilter,
  setTypeFilter,
  withDeadline,
  setWithDeadline,
  uniqueCategories,
  uniqueResourceTypes,
  clearFilters,
  searchPlaceholder,
  showDeadlineFilter = true, // Default to true
}) => {
  const hasActiveFilters = searchQuery || categoryFilter !== 'all' || typeFilter !== 'all' || (showDeadlineFilter && withDeadline);

  return (
    <div className="flex flex-col space-y-4">
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full md:w-[180px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent className="max-h-[300px] overflow-y-auto">
            <SelectItem value="all">All Categories</SelectItem>
            {uniqueCategories.map((category) => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full md:w-[180px]">
            <SelectValue placeholder="Resource Type" />
          </SelectTrigger>
          <SelectContent className="max-h-[300px] overflow-y-auto">
            <SelectItem value="all">All Types</SelectItem>
            {uniqueResourceTypes.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between">
        {showDeadlineFilter && (
          <div className="flex items-center space-x-2">
            <Checkbox
              id={`withDeadline-${searchPlaceholder.replace(/\s+/g, '-')}`} // Unique ID for checkbox
              checked={withDeadline}
              onCheckedChange={(checked) => setWithDeadline(!!checked)}
            />
            <label
              htmlFor={`withDeadline-${searchPlaceholder.replace(/\s+/g, '-')}`}
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              With deadline
            </label>
          </div>
        )}
        {/* Ensure spacer takes up space if deadline filter is hidden but clear button is needed */}
        {!showDeadlineFilter && hasActiveFilters && <div className="flex-grow"></div>}


        {hasActiveFilters && (
          <Button variant="ghost" className="h-8 px-2 lg:px-3" onClick={clearFilters}>
            <FilterX className="mr-2 h-4 w-4" />
            Clear filters
          </Button>
        )}
      </div>
    </div>
  );
};

