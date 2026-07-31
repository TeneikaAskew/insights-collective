
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { 
  Trash2, 
  Archive, 
  Mail,
  MoreHorizontal,
  Loader2,
  ArchiveRestore,
  Undo2
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { archiveConversation, unarchiveConversation, deleteConversation, restoreConversation } from '@/services/conversationService';
import { useConfirm } from '@/components/dialogs/DialogsProvider';

import { createLogger } from '@/utils/logger';

const logger = createLogger('renderActions');

interface MessageActionsProps {
  conversationId: string;
  onSuccess?: (actionType: 'archive' | 'unarchive' | 'delete' | 'restore') => void;
  isArchived?: boolean;
  isDeleted?: boolean;
  currentTab?: string;
}

const MessageActions: React.FC<MessageActionsProps> = ({
  conversationId,
  onSuccess,
  isArchived = false,
  isDeleted = false,
  currentTab = 'inbox'
}) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);
  const navigate = useNavigate();
  const confirm = useConfirm();


  const handleMarkAsUnread = async () => {
    if (!user || !conversationId) return;
    
    setLoading('unread');
    try {
      // Find the latest message in the conversation
      const { data: messages, error: messagesError } = await supabase
        .from('messages')
        .select('id')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (messagesError) {
        throw messagesError;
      }
      
      if (!messages || messages.length === 0) {
        throw new Error('No messages found in this conversation');
      }
      
      // Mark the latest message as unread
      const { error: updateError } = await supabase
        .from('messages')
        .update({ read: false })
        .eq('id', messages[0].id);
      
      if (updateError) {
        throw updateError;
      }
      
      toast({
        title: 'Success',
        description: 'Conversation marked as unread',
      });
      
      // Navigate back to the inbox
      navigate('/messages');
    } catch (error) {
      logger.error('Error marking conversation as unread:', error);
      toast({
        title: 'Error',
        description: 'Failed to mark conversation as unread',
        variant: 'destructive',
      });
    } finally {
      setLoading(null);
    }
  };
  
  const handleArchive = async () => {
    if (!user || !conversationId) return;
    
    setLoading('archive');
    try {
      await archiveConversation(conversationId, user.id);
      
      toast({
        title: 'Success',
        description: 'Conversation archived',
      });
      
      if (onSuccess) onSuccess('archive');
    } catch (error) {
      logger.error('Error archiving conversation:', error);
      toast({
        title: 'Error',
        description: 'Failed to archive conversation',
        variant: 'destructive',
      });
    } finally {
      setLoading(null);
    }
  };
  
  const handleUnarchive = async () => {
    if (!user || !conversationId) return;
    
    setLoading('unarchive');
    try {
      await unarchiveConversation(conversationId, user.id);
      
      toast({
        title: 'Success',
        description: 'Conversation unarchived',
      });
      
      if (onSuccess) onSuccess('unarchive');
    } catch (error) {
      logger.error('Error unarchiving conversation:', error);
      toast({
        title: 'Error',
        description: 'Failed to unarchive conversation',
        variant: 'destructive',
      });
    } finally {
      setLoading(null);
    }
  };
  
  const handleDelete = async () => {
    if (!user || !conversationId) return;
    
    const ok = await confirm({ title: 'Delete conversation?', description: 'This permanently removes the conversation.', destructive: true, confirmLabel: 'Delete' });
    if (!ok) {
      return;
    }
    
    setLoading('delete');
    try {
      await deleteConversation(conversationId, user.id);
      
      toast({
        title: 'Success',
        description: 'Conversation deleted',
      });
      
      if (onSuccess) onSuccess('delete');
    } catch (error) {
      logger.error('Error deleting conversation:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete conversation',
        variant: 'destructive',
      });
    } finally {
      setLoading(null);
    }
  };
  
  const handleRestore = async () => {
    if (!user || !conversationId) return;
    
    setLoading('restore');
    try {
      await restoreConversation(conversationId, user.id);
      
      toast({
        title: 'Success',
        description: 'Conversation restored',
      });
      
      if (onSuccess) onSuccess('restore');
    } catch (error) {
      logger.error('Error restoring conversation:', error);
      toast({
        title: 'Error',
        description: 'Failed to restore conversation',
        variant: 'destructive',
      });
    } finally {
      setLoading(null);
    }
  };

  // Determine which actions to show based on current tab and conversation status
  const renderActions = () => {
    if (isDeleted) {
      return (
        <>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={handleRestore}
            disabled={loading !== null}
            className="text-muted-foreground hover:text-ss-peach-deep"
          >
            {loading === 'restore' ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Undo2 className="h-4 w-4 mr-2" />
            )}
            Restore
          </Button>
        </>
      );
    }
    
    if (isArchived) {
      return (
        <>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={handleMarkAsUnread}
            disabled={loading !== null}
            className="text-muted-foreground hover:text-ss-peach-deep"
          >
            {loading === 'unread' ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Mail className="h-4 w-4 mr-2" />
            )}
            Mark unread
          </Button>
          
          <Button 
            variant="ghost" 
            size="sm"
            onClick={handleUnarchive}
            disabled={loading !== null}
            className="text-muted-foreground hover:text-ss-peach-deep"
          >
            {loading === 'unarchive' ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <ArchiveRestore className="h-4 w-4 mr-2" />
            )}
            Unarchive
          </Button>
          
          <Button 
            variant="ghost" 
            size="sm"
            onClick={handleDelete}
            disabled={loading !== null}
            className="text-muted-foreground hover:text-ss-peach-deep"
          >
            {loading === 'delete' ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4 mr-2" />
            )}
            Delete
          </Button>
        </>
      );
    }
    
    // Default inbox actions
    return (
      <>
        <Button 
          variant="ghost" 
          size="sm"
          onClick={handleMarkAsUnread}
          disabled={loading !== null}
          className="text-muted-foreground hover:text-ss-peach-deep"
        >
          {loading === 'unread' ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Mail className="h-4 w-4 mr-2" />
          )}
          Mark unread
        </Button>
        
        <Button 
          variant="ghost" 
          size="sm"
          onClick={handleArchive}
          disabled={loading !== null}
          className="text-muted-foreground hover:text-ss-peach-deep"
        >
          {loading === 'archive' ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Archive className="h-4 w-4 mr-2" />
          )}
          Archive
        </Button>
        
        <Button 
          variant="ghost" 
          size="sm"
          onClick={handleDelete}
          disabled={loading !== null}
          className="text-muted-foreground hover:text-ss-peach-deep"
        >
          {loading === 'delete' ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4 mr-2" />
          )}
          Delete
        </Button>
      </>
    );
  };

  const renderMobileActions = () => {
    const items = [];
    
    if (isDeleted) {
      items.push(
        <DropdownMenuItem key="restore" onClick={handleRestore} disabled={loading !== null}>
          <Undo2 className="h-4 w-4 mr-2" />
          Restore
        </DropdownMenuItem>
      );
    } else {
      items.push(
        <DropdownMenuItem key="mark-unread" onClick={handleMarkAsUnread} disabled={loading !== null}>
          <Mail className="h-4 w-4 mr-2" />
          Mark unread
        </DropdownMenuItem>
      );
      
      if (isArchived) {
        items.push(
          <DropdownMenuItem key="unarchive" onClick={handleUnarchive} disabled={loading !== null}>
            <ArchiveRestore className="h-4 w-4 mr-2" />
            Unarchive
          </DropdownMenuItem>
        );
      } else {
        items.push(
          <DropdownMenuItem key="archive" onClick={handleArchive} disabled={loading !== null}>
            <Archive className="h-4 w-4 mr-2" />
            Archive
          </DropdownMenuItem>
        );
      }
      
      items.push(
        <DropdownMenuItem key="delete" onClick={handleDelete} disabled={loading !== null}>
          <Trash2 className="h-4 w-4 mr-2" />
          Delete
        </DropdownMenuItem>
      );
    }
    
    return items;
  };

  return (
    <div className="flex items-center justify-between p-2 border-b bg-muted">
      <div className="flex space-x-1">
        {/* Desktop view - buttons */}
        <div className="hidden md:flex space-x-1">
          {renderActions()}
        </div>
        
        {/* Mobile view - dropdown */}
        <div className="md:hidden">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" disabled={loading !== null}>
                <MoreHorizontal className="h-4 w-4 mr-2" />
                Actions
                {loading && <Loader2 className="h-4 w-4 ml-2 animate-spin" />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {renderMobileActions()}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      
      <div className="text-sm text-muted-foreground">
        {/* Conversation info could go here */}
      </div>
    </div>
  );
};

export default MessageActions;
