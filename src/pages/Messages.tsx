
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import ConversationList from '@/components/messages/ConversationList';
import MessageThread from '@/components/messages/MessageThread';
import MessageActions from '@/components/messages/MessageActions';
import MessageSuggestions from '@/components/messages/MessageSuggestions';
import { NewConversationButton } from '@/components/messages/NewConversationButton';
import { useConversationList } from '@/hooks/useConversationList';
import { useArchivedConversations } from '@/hooks/useArchivedConversations';
import { useDeletedConversations } from '@/hooks/useDeletedConversations';
import { useConversationMessages } from '@/hooks/useConversationMessages';
import { useMessageSend } from '@/hooks/useMessageSend';

export default function Messages() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [newMessage, setNewMessage] = useState('');
  const [activeTab, setActiveTab] = useState('inbox');

  // Hooks for different conversation types
  const { conversations: inboxConversations, loading: inboxLoading, error: inboxError, refreshConversations: refreshInbox } = useConversationList();
  const { conversations: archivedConversations, loading: archivedLoading, error: archivedError, refreshConversations: refreshArchived } = useArchivedConversations();
  const { conversations: deletedConversations, loading: deletedLoading, error: deletedError, refreshConversations: refreshDeleted } = useDeletedConversations();

  // Hooks for individual conversation
  const { messages, loading: messagesLoading } = useConversationMessages(conversationId);
  const { sendMessage, sending } = useMessageSend();

  // Handle conversation selection
  const handleConversationSelect = (convId: string) => {
    navigate(`/messages/${convId}`);
  };

  // Handle sending a new message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !conversationId || !user) return;

    const success = await sendMessage(conversationId, newMessage.trim());
    if (success) {
      setNewMessage('');
    }
  };

  // Handle selecting a suggested message
  const handleSelectSuggestedMessage = (message: string) => {
    setNewMessage(message);
  };

  // Handle conversation actions
  const handleConversationAction = (actionType: 'archive' | 'unarchive' | 'delete' | 'restore') => {
    // Refresh the appropriate conversation list
    switch (actionType) {
      case 'archive':
        refreshInbox();
        refreshArchived();
        break;
      case 'unarchive':
        refreshArchived();
        refreshInbox();
        break;
      case 'delete':
        refreshInbox();
        refreshArchived();
        refreshDeleted();
        break;
      case 'restore':
        refreshDeleted();
        refreshInbox();
        break;
    }
    
    // Navigate back to messages list if we're viewing the affected conversation
    if (conversationId) {
      navigate('/messages');
    }
  };

  // Get current conversation details
  const getCurrentConversation = () => {
    if (!conversationId) return null;
    
    const allConversations = [
      ...inboxConversations,
      ...archivedConversations,
      ...deletedConversations
    ];
    
    return allConversations.find(conv => conv.id === conversationId);
  };

  const currentConversation = getCurrentConversation();

  // If viewing a specific conversation
  if (conversationId) {
    const isArchived = archivedConversations.some(conv => conv.id === conversationId);
    const isDeleted = deletedConversations.some(conv => conv.id === conversationId);

    return (
      <AppLayout>
        <div className="container mx-auto py-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button 
                variant="ghost" 
                onClick={() => navigate('/messages')}
                className="flex items-center space-x-2"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back to Messages</span>
              </Button>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">
                  {currentConversation?.subject || 'Conversation'}
                </h1>
                <p className="text-muted-foreground">
                  {isDeleted ? 'Deleted conversation' : isArchived ? 'Archived conversation' : 'Active conversation'}
                </p>
              </div>
            </div>
          </div>

          <Card className="h-[600px] flex flex-col">
            {/* Message Actions */}
            <MessageActions
              conversationId={conversationId}
              onSuccess={handleConversationAction}
              isArchived={isArchived}
              isDeleted={isDeleted}
              currentTab={isDeleted ? 'deleted' : isArchived ? 'archived' : 'inbox'}
            />

            {/* Message Thread */}
            <div className="flex-1 overflow-hidden">
              <MessageThread messages={messages} loading={messagesLoading} />
            </div>

            {/* Message Suggestions */}
            {!isDeleted && (
              <MessageSuggestions
                onSelectMessage={handleSelectSuggestedMessage}
                conversationId={conversationId}
                messages={messages}
              />
            )}

            {/* Message Input */}
            {!isDeleted && (
              <div className="p-4 border-t">
                <form onSubmit={handleSendMessage} className="flex space-x-2">
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type your message..."
                    disabled={sending}
                    className="flex-1"
                  />
                  <Button type="submit" disabled={sending || !newMessage.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </div>
            )}
          </Card>
        </div>
      </AppLayout>
    );
  }

  // Default messages list view
  return (
    <AppLayout>
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Messages</h1>
            <p className="text-muted-foreground">
              Connect with instructors and classmates
            </p>
          </div>
          <NewConversationButton />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Your Conversations</CardTitle>
            <CardDescription>
              View and manage your conversations with other users
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="inbox">Inbox</TabsTrigger>
                <TabsTrigger value="archived">Archived</TabsTrigger>
                <TabsTrigger value="deleted">Deleted</TabsTrigger>
              </TabsList>
              
              <TabsContent value="inbox" className="mt-6">
                <ConversationList
                  conversations={inboxConversations}
                  loading={inboxLoading}
                  error={inboxError}
                />
              </TabsContent>
              
              <TabsContent value="archived" className="mt-6">
                <ConversationList
                  conversations={archivedConversations}
                  loading={archivedLoading}
                  error={archivedError}
                />
              </TabsContent>
              
              <TabsContent value="deleted" className="mt-6">
                <ConversationList
                  conversations={deletedConversations}
                  loading={deletedLoading}
                  error={deletedError}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
