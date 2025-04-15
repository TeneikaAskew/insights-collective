
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MessageSquare, Send, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import LoginWall from '@/components/common/LoginWall';
import ConversationList from '@/components/messages/ConversationList';
import ArchivedConversationsList from '@/components/messages/ArchivedConversationsList';
import MessageThread from '@/components/messages/MessageThread';
import { useConversations } from '@/hooks/useConversations';
import { useConversationMessages } from '@/hooks/useConversationMessages';
import { NewConversationButton } from '@/components/messages/NewConversationButton';
import MessageSuggestions from '@/components/messages/MessageSuggestions';
import { archiveConversation, deleteConversation } from '@/services/conversationService';

const Messages = () => {
  const { conversationId } = useParams();
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('inbox');
  const [messageContent, setMessageContent] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const { conversations, loading: loadingConversations, sendMessage, error: conversationsError } = useConversations();
  const { messages, loading: loadingMessages } = useConversationMessages(conversationId);

  useEffect(() => {
    if (conversationsError?.message?.includes('JWT')) {
      toast({
        title: 'Authentication Error',
        description: 'Please sign in to access your messages',
        variant: 'destructive',
      });
      navigate('/login?redirect=/messages');
    }
  }, [conversationsError, toast, navigate]);

  const handleArchiveConversation = async (id: string) => {
    try {
      await archiveConversation(id);
      toast({ title: 'Conversation archived' });
    } catch (err) {
      toast({ title: 'Error archiving conversation', variant: 'destructive' });
    }
  };

  const handleDeleteConversation = async (id: string) => {
    try {
      await deleteConversation(id);
      toast({ title: 'Conversation deleted' });
    } catch (err) {
      toast({ title: 'Error deleting conversation', variant: 'destructive' });
    }
  };

  const handleSendMessage = async () => {
    if (!messageContent.trim() || !conversationId) return;

    const success = await sendMessage(conversationId, messageContent);

    if (success) {
      setMessageContent('');
      toast({
        title: 'Message sent',
        description: 'Your message has been sent successfully',
      });
    }
  };

  const handleSuggestedMessage = (message: string) => {
    setMessageContent(message);
  };

  const filteredConversations = conversations?.filter(conv => {
    if (!searchQuery) return true;

    const searchLower = searchQuery.toLowerCase();
    if (conv.subject?.toLowerCase().includes(searchLower)) return true;

    const hasMatchingParticipant = conv.participants?.some(p =>
      p.profile?.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.profile?.last_name?.toLowerCase().includes(searchQuery.toLowerCase())
    );
    if (hasMatchingParticipant) return true;

    if (conv.last_message?.content?.toLowerCase().includes(searchQuery.toLowerCase())) return true;

    return false;
  });

  if (!isAuthenticated) {
    return <LoginWall message="Sign in to access your messages and connect with instructors and classmates." visibleItems={0} totalItems={conversations?.length ?? 0} />;
  }

  return (
    <AppLayout>
      <div className="container mx-auto">
        <div className="flex flex-col space-y-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold">Messages</h1>
            <div className="ml-auto">
              <NewConversationButton />
            </div>
          </div>

          <Tabs defaultValue={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList>
              <TabsTrigger value="inbox">Inbox</TabsTrigger>
              <TabsTrigger value="sent">Sent</TabsTrigger>
              <TabsTrigger value="archived">Archived</TabsTrigger>
            </TabsList>

            <TabsContent value="inbox" className="space-y-4">
              <div className="relative">
                <Input placeholder="Search messages..." className="pl-10" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                <Search className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-1 h-full">
                  <ConversationList
                    conversations={filteredConversations || []}
                    loading={loadingConversations}
                    error={conversationsError}
                    onArchive={handleArchiveConversation}
                    onDelete={handleDeleteConversation}
                  />
                </div>

                {conversationId ? (
                  <div className="md:col-span-2 border rounded-md flex flex-col h-[calc(70vh-100px)]">
                    <div className="flex-1 overflow-y-auto">
                      <MessageThread messages={messages || []} loading={loadingMessages} />
                    </div>

                    <MessageSuggestions onSelectMessage={handleSuggestedMessage} conversationId={conversationId} messages={messages} />

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

                        <Button onClick={handleSendMessage} disabled={!messageContent.trim()} className="bg-amber-600 hover:bg-amber-700">
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
                      <p className="text-gray-600 mb-4">Select a conversation from the list or start a new one</p>
                      <NewConversationButton />
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="sent" className="space-y-4">
              <div className="relative">
                <Input
                  placeholder="Search sent messages..."
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <Search className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
              </div>

              <div className="border rounded-md divide-y">
                {activeTab === 'sent' && conversations?.filter(c => c.last_message?.sender_id === user?.id)?.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground">No sent messages yet.</div>
                ) : (
                  <ConversationList
                    conversations={conversations?.filter(c => c.last_message?.sender_id === user?.id) || []}
                    loading={loadingConversations}
                    error={conversationsError}
                    onArchive={handleArchiveConversation}
                    onDelete={handleDeleteConversation}
                  />
                )}
              </div>
            </TabsContent>

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
                  <ArchivedConversationsList
                    conversations={conversations?.filter(c => 
                      c.archived && !c.deleted_at &&
                      (searchQuery ? (
                        c.participants.some((p: any) => 
                          p.profile?.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.profile?.last_name?.toLowerCase().includes(searchQuery.toLowerCase())
                        ) ||
                        c.last_message?.content?.toLowerCase().includes(searchQuery.toLowerCase())
                      ) : true)
                    )}
                    loading={loadingConversations}
                    error={conversationsError}
                    onRestore={async (id) => {
                      try {
                        await archiveConversation(id, false);
                        toast({ title: 'Conversation restored' });
                      } catch (err) {
                        toast({ 
                          title: 'Error restoring conversation', 
                          variant: 'destructive' 
                        });
                      }
                    }}
                  />
                </div>

                {conversationId ? (
                  <div className="md:col-span-2 border rounded-md flex flex-col h-[calc(70vh-100px)]">
                    <div className="flex-1 overflow-y-auto">
                      <MessageThread messages={messages || []} loading={loadingMessages} />
                    </div>

                    <MessageSuggestions onSelectMessage={handleSuggestedMessage} conversationId={conversationId} messages={messages} />

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

                        <Button onClick={handleSendMessage} disabled={!messageContent.trim()} className="bg-amber-600 hover:bg-amber-700">
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
          </Tabs>
        </div>
      </div>
    </AppLayout>
  );
};

export default Messages;
