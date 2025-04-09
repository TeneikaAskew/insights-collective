
import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { MessageSquare, Send, Paperclip, User, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import LoginWall from '@/components/common/LoginWall';

const Messages = () => {
  const { conversationId } = useParams();
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('inbox');
  const [messageContent, setMessageContent] = useState('');
  const [recipients, setRecipients] = useState('');
  const [subject, setSubject] = useState('');
  
  // Placeholder data - in a real app, this would come from an API/Supabase
  const conversations = [
    { id: '1', with: 'John Doe', lastMessage: 'Hello, how are you?', date: '2h ago', unread: true },
    { id: '2', with: 'Jane Smith', lastMessage: 'Can you help me with the assignment?', date: '1d ago', unread: false },
    { id: '3', with: 'Admin', lastMessage: 'Welcome to the platform!', date: '3d ago', unread: false },
  ];

  const handleSendMessage = () => {
    // In a real app, this would send the message to the API/Supabase
    toast({
      title: "Message sent",
      description: "Your message has been sent successfully.",
    });
    setMessageContent('');
    setRecipients('');
    setSubject('');
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
      totalItems={conversations.length}
    />;
  }

  return (
    <AppLayout>
      <div className="container mx-auto">
        <div className="flex flex-col space-y-4">
          <h1 className="text-2xl font-bold">Messages</h1>
          
          <Tabs defaultValue={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList>
              <TabsTrigger value="inbox">Inbox</TabsTrigger>
              <TabsTrigger value="sent">Sent</TabsTrigger>
              <TabsTrigger value="compose">Compose</TabsTrigger>
            </TabsList>
            
            <TabsContent value="inbox" className="space-y-4">
              <div className="relative">
                <Input 
                  placeholder="Search messages..." 
                  className="pl-10"
                />
                <MessageSquare className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
              </div>
              
              <div className="border rounded-md divide-y">
                {conversations.map(conv => (
                  <div 
                    key={conv.id} 
                    className={`p-4 flex justify-between items-center hover:bg-accent cursor-pointer ${conv.unread ? 'bg-accent/10 font-medium' : ''}`}
                  >
                    <div className="flex items-center space-x-3">
                      <User className="h-8 w-8 text-muted-foreground" />
                      <div>
                        <div className="font-medium">{conv.with}</div>
                        <div className="text-sm text-muted-foreground truncate max-w-md">{conv.lastMessage}</div>
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">{conv.date}</div>
                  </div>
                ))}
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
            
            <TabsContent value="compose" className="space-y-4">
              <div className="border rounded-md p-4 space-y-4">
                <div className="space-y-2">
                  <label htmlFor="recipients" className="text-sm font-medium">To:</label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select recipient" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user1">John Doe</SelectItem>
                      <SelectItem value="user2">Jane Smith</SelectItem>
                      <SelectItem value="all">All Users (Admin Only)</SelectItem>
                      <SelectItem value="instructors">All Instructors (Admin Only)</SelectItem>
                      <SelectItem value="students">All Students (Admin Only)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <label htmlFor="subject" className="text-sm font-medium">Subject:</label>
                  <Input 
                    id="subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Enter message subject..."
                  />
                </div>
                
                <div className="space-y-2">
                  <label htmlFor="message" className="text-sm font-medium">Message:</label>
                  <Textarea 
                    id="message"
                    value={messageContent}
                    onChange={(e) => setMessageContent(e.target.value)}
                    placeholder="Type your message here..."
                    rows={6}
                  />
                </div>
                
                <div className="flex justify-between items-center">
                  <Button variant="outline" onClick={handleAttachFile}>
                    <Paperclip className="h-4 w-4 mr-2" />
                    Attach File
                  </Button>
                  
                  <Button onClick={handleSendMessage}>
                    <Send className="h-4 w-4 mr-2" />
                    Send Message
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AppLayout>
  );
};

export default Messages;
