import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MessageSquare, Send, Search, Inbox, Archive, Trash2, ArchiveRestore, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import LoginWall from '@/components/common/LoginWall';
import ConversationList from '@/components/messages/ConversationList';
import MessageThread from '@/components/messages/MessageThread';
import { useConversationList } from '@/hooks/useConversationList';
import { useArchivedConversations } from '@/hooks/useArchivedConversations';
import { useDeletedConversations } from '@/hooks/useDeletedConversations';
import { useConversationMessages } from '@/hooks/useConversationMessages';
import { useMessageSend } from '@/hooks/useMessageSend';
import { NewConversationButton } from '@/components/messages/NewConversationButton';
import MessageSuggestions from '@/components/messages/MessageSuggestions';
import MessageActions from '@/components/messages/MessageActions';
import { Conversation } from '@/types/supabase';

const Messages = () => {
  const { conversationId } = useParams();
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState('inbox');
  const [messageContent, setMessageContent] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Use dedicated hooks for different conversation types
  const { conversations: inboxConversations, loading: loadingInbox, error: inboxError, refreshConversations: refreshInbox } = useConversationList();
  const { conversations: archivedConversations, loading: loadingArchived, refreshConversations: refreshArchived } = useArchivedConversations();
  const { conversations: deletedConversations, loading: loadingDeleted, refreshConversations: refreshDeleted } = useDeletedConversations();
  const { sendMessage } = useMessageSend();
  
  const { messages, loading: loadingMessages } = useConversationMessages(conversationId);

  // If we encounter an authentication error, show a toast and navigate to login
  useEffect(() => {
    if (inboxError?.message?.includes('JWT')) {
      toast({
        title: 'Authentication Error',
        description: 'Please sign in to access your messages',
        variant: 'destructive',
      });
      navigate('/login?redirect=/messages');
    }
  }, [inboxError, toast, navigate]);

  // If URL contains conversationId, navigate to the conversation detail
  useEffect(() => {
    if (conversationId) {
      // Navigate to the specific conversation route
      navigate(`/messages/conversation/${conversationId}`);
    }
  }, [conversationId, navigate]);

  // Function to handle sending messages
  const handleSendMessage = async () => {
    if (!messageContent.trim() || !conversationId) {
      toast({
        title: 'Error',
        description: 'Please enter a message',
        variant: 'destructive',
      });
      return;
    }

    try {
      const success = await sendMessage(conversationId, messageContent.trim());
      if (success) {
        setMessageContent('');
        toast({
          title: 'Success',
          description: 'Message sent successfully',
        });
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: 'Error',
        description: 'Failed to send message',
        variant: 'destructive',
      });
    }
  };

  const handleConversationClick = (conversation: Conversation) => {
    // Navigate to conversation detail route
    navigate(`/messages/conversation/${conversation.id}`);
  };

  const handleArchiveConversation = async (conversationId: string) => {
    try {
      console.log('Archiving conversation:', conversationId);
      // The archive function will be implemented in services
      await refreshInbox();
      await refreshArchived();
      toast({
        title: 'Success',
        description: 'Conversation archived',
      });
    } catch (error) {
      console.error('Error archiving conversation:', error);
      toast({
        title: 'Error',
        description: 'Failed to archive conversation',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteConversation = async (conversationId: string) => {
    try {
      console.log('Deleting conversation:', conversationId);
      // The delete function will be implemented in services
      await refreshInbox();
      await refreshDeleted();
      toast({
        title: 'Success',
        description: 'Conversation deleted',
      });
    } catch (error) {
      console.error('Error deleting conversation:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete conversation',
        variant: 'destructive',
      });
    }
  };

  const handleUnarchiveConversation = async (conversationId: string) => {
    try {
      console.log('Unarchiving conversation:', conversationId);
      // The unarchive function will be implemented in services
      await refreshArchived();
      await refreshInbox();
      toast({
        title: 'Success',
        description: 'Conversation moved to inbox',
      });
    } catch (error) {
      console.error('Error unarchiving conversation:', error);
      toast({
        title: 'Error',
        description: 'Failed to unarchive conversation',
        variant: 'destructive',
      });
    }
  };

  const handleRestoreConversation = async (conversationId: string) => {
    try {
      console.log('Restoring conversation:', conversationId);
      // The restore function will be implemented in services
      await refreshDeleted();
      await refreshInbox();
      toast({
        title: 'Success',
        description: 'Conversation restored',
      });
    } catch (error) {
      console.error('Error restoring conversation:', error);
      toast({
        title: 'Error',
        description: 'Failed to restore conversation',
        variant: 'destructive',
      });
    }
  };

  // Filter conversations based on search query
  const filterConversations = (conversations: Conversation[]) => {
    if (!searchQuery.trim()) return conversations;
    
    return conversations.filter(conversation => 
      conversation.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conversation.participants?.some(p => 
        p.profile?.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.profile?.last_name?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    );
  };

  if (!isAuthenticated) {
    return (
      <AppLayout>
        <LoginWall message="Please sign in to access your messages" />
      </AppLayout>
    );
  }

  const filteredInboxConversations = filterConversations(inboxConversations);
  const filteredArchivedConversations = filterConversations(archivedConversations);
  const filteredDeletedConversations = filterConversations(deletedConversations);

  return (
    <AppLayout>
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <MessageSquare className="h-6 w-6 text-blue-600" />
            <h1 className="text-2xl font-bold">Messages</h1>
          </div>
          <NewConversationButton />
        </div>

        {/* Search Bar */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Tabs for different conversation types */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="inbox" className="flex items-center space-x-2">
              <Inbox className="h-4 w-4" />
              <span>Inbox ({filteredInboxConversations.length})</span>
            </TabsTrigger>
            <TabsTrigger value="archived" className="flex items-center space-x-2">
              <Archive className="h-4 w-4" />
              <span>Archived ({filteredArchivedConversations.length})</span>
            </TabsTrigger>
            <TabsTrigger value="deleted" className="flex items-center space-x-2">
              <Trash2 className="h-4 w-4" />
              <span>Deleted ({filteredDeletedConversations.length})</span>
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 mt-4">
            <TabsContent value="inbox" className="h-full">
              <ConversationList
                conversations={filteredInboxConversations}
                loading={loadingInbox}
                error={inboxError}
                onConversationClick={handleConversationClick}
                actions={(conversation) => (
                  <div>Actions</div>
                )}
              />
            </TabsContent>

            <TabsContent value="archived" className="h-full">
              <ConversationList
                conversations={filteredArchivedConversations}
                loading={loadingArchived}
                onConversationClick={handleConversationClick}
                actions={(conversation) => (
                  <div>Actions</div>
                )}
              />
            </TabsContent>

            <TabsContent value="deleted" className="h-full">
              <ConversationList
                conversations={filteredDeletedConversations}
                loading={loadingDeleted}
                onConversationClick={handleConversationClick}
                actions={(conversation) => (
                  <div>Actions</div>
                )}
              />
            </TabsContent>
          </div>
        </Tabs>

        {/* Message Suggestions - Only show when no conversation is selected */}
        {!conversationId && <MessageSuggestions onSelectMessage={() => {}} />}
      </div>
    </AppLayout>
  );
};

export default Messages;