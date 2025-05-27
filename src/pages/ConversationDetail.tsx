import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, Archive, Trash2, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import LoginWall from '@/components/common/LoginWall';
import MessageThread from '@/components/messages/MessageThread';
import { useConversationMessages } from '@/hooks/useConversationMessages';
import { useMessageSend } from '@/hooks/useMessageSend';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { archiveConversation, deleteConversation } from '@/services/conversationActions';

const ConversationDetail = () => {
  const { conversationId } = useParams();
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [messageContent, setMessageContent] = useState('');

  const { messages, loading: loadingMessages } = useConversationMessages(conversationId);
  const { sendMessage, sending } = useMessageSend();

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

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleArchive = async () => {
    if (!conversationId || !user) return;
    
    try {
      await archiveConversation(conversationId, user.id);
      toast({
        title: 'Success',
        description: 'Conversation archived',
      });
      navigate('/messages');
    } catch (error) {
      console.error('Error archiving conversation:', error);
      toast({
        title: 'Error',
        description: 'Failed to archive conversation',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async () => {
    if (!conversationId || !user) return;
    
    try {
      await deleteConversation(conversationId, user.id);
      toast({
        title: 'Success',
        description: 'Conversation deleted',
      });
      navigate('/messages');
    } catch (error) {
      console.error('Error deleting conversation:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete conversation',
        variant: 'destructive',
      });
    }
  };

  if (!isAuthenticated) {
    return (
      <AppLayout>
        <LoginWall />
      </AppLayout>
    );
  }

  if (!conversationId) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-2">No conversation selected</h2>
            <p className="text-gray-600 mb-4">Select a conversation from your messages to start chatting.</p>
            <Button onClick={() => navigate('/messages')}>
              Back to Messages
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  // Get conversation info from the first message or create placeholder
  const conversationInfo = messages.length > 0 
    ? {
        subject: `Conversation with ${messages[0]?.sender?.first_name || 'Unknown'} ${messages[0]?.sender?.last_name || 'User'}`,
        participants: [messages[0]?.sender].filter(Boolean)
      }
    : { subject: 'Conversation', participants: [] };

  return (
    <AppLayout>
      <div className="h-full flex flex-col">
        {/* Header */}
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => navigate('/messages')}
                  className="p-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                
                <div className="flex items-center space-x-3">
                  {conversationInfo.participants.map((participant, index) => (
                    <Avatar key={index} className="h-8 w-8">
                      <AvatarImage src={participant.avatar_url || ''} />
                      <AvatarFallback>
                        {participant.first_name?.charAt(0) || 'U'}
                        {participant.last_name?.charAt(0) || ''}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                  
                  <div>
                    <h1 className="text-lg font-semibold">{conversationInfo.subject}</h1>
                    <p className="text-sm text-gray-500">
                      {conversationInfo.participants.length} participant{conversationInfo.participants.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
              </div>

              {/* Actions Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="p-2">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleArchive}>
                    <Archive className="h-4 w-4 mr-2" />
                    Archive
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleDelete} className="text-red-600">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardHeader>
        </Card>

        {/* Message Thread */}
        <div className="flex-1 overflow-hidden">
          <MessageThread 
            messages={messages} 
            loading={loadingMessages}
          />
        </div>

        {/* Message Input */}
        <Card className="mt-4">
          <CardContent className="p-4">
            <div className="flex space-x-2">
              <Input
                placeholder="Type a message..."
                value={messageContent}
                onChange={(e) => setMessageContent(e.target.value)}
                onKeyPress={handleKeyPress}
                className="flex-1"
                disabled={sending}
              />
              <Button 
                onClick={handleSendMessage}
                disabled={!messageContent.trim() || sending}
                size="sm"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default ConversationDetail;