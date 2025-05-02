
import React from 'react';
import { Button } from '@/components/ui/button';
import { ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem
} from '@/components/ui/dropdown-menu';

interface StatusDropdownProps {
  status: 'draft' | 'published' | 'archived';
  onStatusChange: (status: 'draft' | 'published' | 'archived') => void;
}

export function StatusDropdown({ status, onStatusChange }: StatusDropdownProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2">
          {status === 'published' ? 'Published' : 
           status === 'draft' ? 'Draft' : 'Archived'}
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onStatusChange('published')}>
          Publish
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onStatusChange('draft')}>
          Save as Draft
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onStatusChange('archived')}>
          Archive
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
