
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MessageSquare, Send, Paperclip, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import LoginWall from '@/components/common/LoginWall';
import ConversationList from '@/components/messages/ConversationList';
import MessageThread from '@/components/messages/MessageThread';
import NewConversationDialog from '@/components/messages/NewConversationDialog';
import { useConversations } from '@/hooks/useConversations';
import { useConversationMessages } from '@/hooks/useConversationMessages';

const Messages = () => {
  const { conversationId } = useParams();
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('inbox');
  const [messageContent, setMessageContent] = useState('');
  const [newConversationOpen, setNewConversationOpen] = useState(false);
  
  const { conversations, loading: loadingConversations, createConversation, sendMessage, error: conversationsError } = useConversations();
  const { messages, loading: loadingMessages } = useConversationMessages(conversationId);

  const handleSendMessage = async () => {
    if (!messageContent.trim() || !conversationId) return;
    
    const success = await sendMessage(conversationId, messageContent);
    
    if (success) {
      setMessageContent('');
    }
  };

  const handleAttachFile = () => {
    // File attachment logic would go here
    toast({
      title: "Feature coming soon",
      description: "File attachments will be available in the next update.",
    });
  };

  if (!isAuthenticated) {
    return <LoginWall 
      message="Sign in to access your messages and connect with instructors and classmates."
      visibleItems={0}
      totalItems={conversations?.length ?? 0}
    />;
  }

  return (
    <AppLayout>
      <div className="container mx-auto">
        <div className="flex flex-col space-y-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold">Messages</h1>
            <Button onClick={() => setNewConversationOpen(true)} className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700">
              <Plus className="h-4 w-4" />
              New Conversation
            </Button>
          </div>
          
          <Tabs defaultValue={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList>
              <TabsTrigger value="inbox">Inbox</TabsTrigger>
              <TabsTrigger value="sent">Sent</TabsTrigger>
            </TabsList>
            
            <TabsContent value="inbox" className="space-y-4">
              <div className="relative">
                <Input 
                  placeholder="Search messages..." 
                  className="pl-10"
                />
                <MessageSquare className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-1 h-full">
                  <ConversationList 
                    conversations={conversations || []} 
                    loading={loadingConversations}
                    error={conversationsError} 
                  />
                </div>
                
                {conversationId ? (
                  <div className="md:col-span-2 border rounded-md flex flex-col h-[calc(70vh-100px)]">
                    <div className="flex-1 overflow-y-auto">
                      <MessageThread messages={messages || []} loading={loadingMessages} />
                    </div>
                    
                    <div className="p-4 border-t">
                      <div className="flex space-x-2">
                        <Button 
                          variant="outline"
                          size="icon"
                          onClick={handleAttachFile}
                        >
                          <Paperclip className="h-4 w-4" />
                        </Button>
                        
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
                      <Button onClick={() => setNewConversationOpen(true)} className="bg-amber-600 hover:bg-amber-700">
                        Start a new conversation
                      </Button>
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
                />
                <MessageSquare className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
              </div>
              
              <div className="border rounded-md divide-y">
                <div className="p-6 text-center text-muted-foreground">
                  No sent messages yet.
                </div>
              </div>
            </TabsContent>
          </Tabs>
          
          <NewConversationDialog
            open={newConversationOpen}
            onOpenChange={setNewConversationOpen}
            onCreateConversation={createConversation}
          />
        </div>
      </div>
    </AppLayout>
  );
};

export default Messages;
