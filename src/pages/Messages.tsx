
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MessageSquare, Send, Search, Inbox, ExternalLink, Archive, Trash2, ArchiveRestore, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import LoginWall from '@/components/common/LoginWall';
import ConversationList from '@/components/messages/ConversationList';
import MessageThread from '@/components/messages/MessageThread';
import { useConversations } from '@/hooks/useConversations';
import { useConversationMessages } from '@/hooks/useConversationMessages';
import { NewConversationButton } from '@/components/messages/NewConversationButton';
import MessageSuggestions from '@/components/messages/MessageSuggestions';
import MessageActions from '@/components/messages/MessageActions';
import { fetchArchivedUserConversations, fetchDeletedUserConversations } from '@/services/conversationService';
import { useConversationList } from '@/hooks/useConversationList';
import { useMessageSend } from '@/hooks/useMessageSend'; // Add this import
import { Conversation } from '@/types/supabase';

const Messages = () => {
  const { conversationId } = useParams();
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('inbox');
  const [messageContent, setMessageContent] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // State for different conversation lists
  const { conversations: inboxConversations, loading: loadingInbox, error: inboxError } = useConversationList();
  const { sendMessage } = useMessageSend(); // Use the dedicated message sending hook
  const [archivedConversations, setArchivedConversations] = useState<Conversation[]>([]);
  const [loadingArchived, setLoadingArchived] = useState(false);
  const [deletedConversations, setDeletedConversations] = useState<Conversation[]>([]);
  const [loadingDeleted, setLoadingDeleted] = useState(false);

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

  // Load archived or deleted conversations when tab changes
  useEffect(() => {
    if (!user) return;

    const loadTabData = async () => {
      if (activeTab === 'archived') {
        setLoadingArchived(true);
        try {
          const data = await fetchArchivedUserConversations(user.id);
          setArchivedConversations(data);
        } catch (error) {
          console.error('Error fetching archived conversations:', error);
          toast({ title: 'Error', description: 'Failed to load archived conversations', variant: 'destructive' });
        } finally {
          setLoadingArchived(false);
        }
      } else if (activeTab === 'deleted') {
        setLoadingDeleted(true);
        try {
          const data = await fetchDeletedUserConversations(user.id);
          setDeletedConversations(data);
        } catch (error) {
          console.error('Error fetching deleted conversations:', error);
          toast({ title: 'Error', description: 'Failed to load deleted conversations', variant: 'destructive' });
        } finally {
          setLoadingDeleted(false);
        }
      }
    };

    loadTabData();
  }, [activeTab, user, toast]);

  const handleSendMessage = async () => {
    if (!messageContent.trim() || !conversationId || !user) return;

    const success = await sendMessage(conversationId, messageContent);

    if (success) {
      setMessageContent('');
      toast({
        title: 'Message sent',
        description: 'Your message has been sent successfully',
      });
    } else {
      toast({
        title: 'Error',
        description: 'Failed to send message.',
        variant: 'destructive',
      });
    }
  };

  const handleSuggestedMessage = (message: string) => {
    setMessageContent(message);
  };

  // Filter conversations based on search query
  const filterConversations = (conversationList: Conversation[] | undefined): Conversation[] => {
    if (!searchQuery) return conversationList || [];

    const searchLower = searchQuery.toLowerCase();

    return (conversationList || []).filter(conv => {
      if (conv.subject?.toLowerCase().includes(searchLower)) return true;

      const hasMatchingParticipant = conv.participants?.some(p =>
        p.profile?.first_name?.toLowerCase().includes(searchLower) ||
        p.profile?.last_name?.toLowerCase().includes(searchLower)
      );
      if (hasMatchingParticipant) return true;

      if (conv.last_message?.content?.toLowerCase().includes(searchLower)) return true;

      return false;
    });
  };

  // Handler for successful actions
  const handleActionSuccess = (actionType: 'archive' | 'unarchive' | 'delete' | 'restore') => {
    navigate('/messages');

    if (activeTab === 'inbox' && (actionType === 'unarchive' || actionType === 'restore')) {
      // Need a way to trigger refetch in useConversationList if not handled by realtime
    }
    if (activeTab === 'archived' && user && (actionType === 'archive' || actionType === 'unarchive')) {
      fetchArchivedUserConversations(user.id).then(setArchivedConversations);
    }
    if (activeTab === 'deleted' && user && (actionType === 'delete' || actionType === 'restore')) {
      fetchDeletedUserConversations(user.id).then(setDeletedConversations);
    }

    toast({
      title: 'Success',
      description: `Conversation ${actionType}d.`,
    });
  };

  // Get filtered conversations for each tab
  const filteredInboxConversations = filterConversations(inboxConversations);
  const filteredArchivedConversations = filterConversations(archivedConversations);
  const filteredDeletedConversations = filterConversations(deletedConversations);

  if (!isAuthenticated) {
    return <LoginWall 
      message="Sign in to access your messages and connect with instructors and classmates."
      visibleItems={0}
      totalItems={inboxConversations?.length ?? 0}
    />;
  }

  return (
    <AppLayout>
      <div className="container mx-auto">
        <div className="flex flex-col space-y-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold">Messages</h1>
            <NewConversationButton />
          </div>
          
          <Tabs defaultValue={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList>
              <TabsTrigger value="inbox"><Inbox className="h-4 w-4 mr-2" />Inbox</TabsTrigger>
              <TabsTrigger value="archived"><Archive className="h-4 w-4 mr-2" />Archived</TabsTrigger>
              <TabsTrigger value="deleted"><Trash2 className="h-4 w-4 mr-2" />Deleted</TabsTrigger>
            </TabsList>
            
            {/* INBOX TAB */}
            <TabsContent value="inbox" className="space-y-4">
              <div className="relative">
                <Input 
                  placeholder="Search messages..." 
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <Search className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-1 h-full">
                  <ConversationList 
                    conversations={filteredInboxConversations} 
                    loading={loadingInbox}
                    error={inboxError} 
                  />
                </div>
                
                {conversationId ? (
                  <div className="md:col-span-2 border rounded-md flex flex-col h-[calc(70vh-100px)]">
                    <MessageActions 
                      conversationId={conversationId}
                      onSuccess={handleActionSuccess}
                      isArchived={archivedConversations.some(c => c.id === conversationId)}
                      isDeleted={deletedConversations.some(c => c.id === conversationId)}
                      currentTab={activeTab}
                    />
                    
                    <div className="flex-1 overflow-y-auto">
                      <MessageThread messages={messages || []} loading={loadingMessages} />
                    </div>
                    
                    <MessageSuggestions
                      onSelectMessage={handleSuggestedMessage}
                      conversationId={conversationId}
                      messages={messages}
                    />
                    
                    <div className="p-4 border-t">
                      <div className="flex space-x-2">
                        <Input
                          value={messageContent}
                          onChange={(e) => setMessageContent(e.target.value)}
                          placeholder="Type your message..."
                          className="flex-1"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleSendMessage();
                            }
                          }}
                        />
                        
                        <Button
                          onClick={handleSendMessage}
                          disabled={!messageContent.trim()}
                          className="bg-amber-600 hover:bg-amber-700"
                        >
                          <Send className="h-4 w-4 mr-2" />
                          Send
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="md:col-span-2 border rounded-md flex items-center justify-center h-[calc(70vh-100px)]">
                    <div className="text-center p-6">
                      <MessageSquare className="h-12 w-12 text-amber-500 mx-auto mb-4" />
                      <h3 className="text-lg font-medium mb-2 text-gray-800">No conversation selected</h3>
                      <p className="text-gray-600 mb-4">
                        Select a conversation from the list or start a new one
                      </p>
                      <NewConversationButton />
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
            
            {/* ARCHIVED TAB */}
            <TabsContent value="archived" className="space-y-4">
              <div className="relative">
                <Input 
                  placeholder="Search archived messages..." 
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <Search className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-1 h-full">
                  <ConversationList 
                    conversations={filteredArchivedConversations} 
                    loading={loadingArchived}
                    error={null} 
                  />
                </div>
                
                {conversationId && archivedConversations.some(c => c.id === conversationId) ? (
                  <div className="md:col-span-2 border rounded-md flex flex-col h-[calc(70vh-100px)]">
                    <MessageActions 
                      conversationId={conversationId}
                      onSuccess={handleActionSuccess}
                      isArchived={true}
                      isDeleted={false}
                      currentTab={activeTab}
                    />
                    
                    <div className="flex-1 overflow-y-auto">
                      <MessageThread messages={messages || []} loading={loadingMessages} />
                    </div>
                    
                    <MessageSuggestions
                      onSelectMessage={handleSuggestedMessage}
                      conversationId={conversationId}
                      messages={messages}
                    />
                    
                    <div className="p-4 border-t">
                      <div className="flex space-x-2">
                        <Input
                          value={messageContent}
                          onChange={(e) => setMessageContent(e.target.value)}
                          placeholder="Type your message..."
                          className="flex-1"
                          disabled
                        />
                        
                        <Button
                          onClick={handleSendMessage}
                          disabled
                          className="bg-amber-600 hover:bg-amber-700"
                        >
                          <Send className="h-4 w-4 mr-2" />
                          Send
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="md:col-span-2 border rounded-md flex items-center justify-center h-[calc(70vh-100px)]">
                    <div className="text-center p-6">
                      <Archive className="h-12 w-12 text-amber-500 mx-auto mb-4" />
                      <h3 className="text-lg font-medium mb-2 text-gray-800">Archived Conversations</h3>
                      <p className="text-gray-600 mb-4">
                        Select an archived conversation to view it. You can unarchive it using the actions above.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
            
            {/* DELETED TAB */}
            <TabsContent value="deleted" className="space-y-4">
              <div className="relative">
                <Input 
                  placeholder="Search deleted messages..." 
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <Search className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-1 h-full">
                  <ConversationList 
                    conversations={filteredDeletedConversations} 
                    loading={loadingDeleted}
                    error={null} 
                  />
                </div>
                
                {conversationId && deletedConversations.some(c => c.id === conversationId) ? (
                  <div className="md:col-span-2 border rounded-md flex flex-col h-[calc(70vh-100px)]">
                    <MessageActions 
                      conversationId={conversationId}
                      onSuccess={handleActionSuccess}
                      isArchived={false}
                      isDeleted={true}
                      currentTab={activeTab}
                    />
                    
                    <div className="flex-1 overflow-y-auto">
                      <MessageThread messages={messages || []} loading={loadingMessages} />
                    </div>
                    
                    <MessageSuggestions
                      onSelectMessage={handleSuggestedMessage}
                      conversationId={conversationId}
                      messages={messages}
                    />
                    
                    <div className="p-4 border-t">
                      <div className="flex space-x-2">
                        <Input
                          value={messageContent}
                          onChange={(e) => setMessageContent(e.target.value)}
                          placeholder="Type your message..."
                          className="flex-1"
                          disabled
                        />
                        
                        <Button
                          onClick={handleSendMessage}
                          disabled
                          className="bg-amber-600 hover:bg-amber-700"
                        >
                          <Send className="h-4 w-4 mr-2" />
                          Send
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="md:col-span-2 border rounded-md flex items-center justify-center h-[calc(70vh-100px)]">
                    <div className="text-center p-6">
                      <Trash2 className="h-12 w-12 text-amber-500 mx-auto mb-4" />
                      <h3 className="text-lg font-medium mb-2 text-gray-800">Deleted Conversations</h3>
                      <p className="text-gray-600 mb-4">
                        These are conversations you've deleted. Select one to view it or restore it.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AppLayout>
  );
};

export default Messages;
