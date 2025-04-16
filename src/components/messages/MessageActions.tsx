import React from 'react';
import { Button } from '@/components/ui/button';
import { 
  Trash2, 
  Archive, 
  Mail,
  MoreHorizontal
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';

interface MessageActionsProps {
  conversationId: string;
  onMarkUnread: () => void;
  onArchive: () => void;
  onDelete: () => void;
}

const MessageActions: React.FC<MessageActionsProps> = ({
  conversationId,
  onMarkUnread,
  onArchive,
  onDelete
}) => {
  const { toast } = useToast();

  // Placeholder for actions not yet implemented
  const handleAction = (action: string) => {
    toast({
      title: 'Action not implemented',
      description: `The ${action} action will be available soon.`,
    });
  };

  return (
    <div className="flex items-center justify-between p-2 border-b bg-gray-50">
      <div className="flex space-x-1">
        {/* Desktop view - buttons */}
        <div className="hidden md:flex space-x-1">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={onMarkUnread || (() => handleAction('Mark unread'))}
            className="text-gray-600 hover:text-amber-600"
          >
            <Mail className="h-4 w-4 mr-2" />
            Mark unread
          </Button>
          
          <Button 
            variant="ghost" 
            size="sm"
            onClick={onArchive || (() => handleAction('Archive'))}
            className="text-gray-600 hover:text-amber-600"
          >
            <Archive className="h-4 w-4 mr-2" />
            Archive
          </Button>
          
          <Button 
            variant="ghost" 
            size="sm"
            onClick={onDelete || (() => handleAction('Delete'))}
            className="text-gray-600 hover:text-amber-600"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
        
        {/* Mobile view - dropdown */}
        <div className="md:hidden">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreHorizontal className="h-4 w-4" />
                Actions
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={onMarkUnread || (() => handleAction('Mark unread'))}>
                <Mail className="h-4 w-4 mr-2" />
                Mark unread
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onArchive || (() => handleAction('Archive'))}>
                <Archive className="h-4 w-4 mr-2" />
                Archive
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDelete || (() => handleAction('Delete'))}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      
      <div className="text-sm text-gray-500">
        {/* Conversation info could go here */}
      </div>
    </div>
  );
};

export default MessageActions;
