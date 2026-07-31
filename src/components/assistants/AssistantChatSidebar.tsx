
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { PlusCircle, Search, MessageSquare, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Chat } from './AssistantChatInterface';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';

interface AssistantChatSidebarProps {
  currentChat: Chat | null;
  onNewChat: () => void;
  onChatSelect: (chatId: string) => void;
}

const AssistantChatSidebar = ({ 
  currentChat, 
  onNewChat, 
  onChatSelect 
}: AssistantChatSidebarProps) => {
  const { toast } = useToast();
  const [chats, setChats] = useState<Chat[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  useEffect(() => {
    // Load chats from localStorage
    const savedChats = JSON.parse(localStorage.getItem('assistantChats') || '[]');
    
    // Convert string dates to Date objects and ensure unique IDs
    const parsedChats = savedChats.map((chat: any) => ({
      ...chat,
      // Generate a random ID if missing or duplicate
      id: chat.id || uuidv4(),
      createdAt: new Date(chat.createdAt),
      updatedAt: new Date(chat.updatedAt),
      messages: chat.messages.map((msg: any) => ({
        ...msg,
        id: msg.id || uuidv4(), // Ensure each message has a unique ID
        timestamp: new Date(msg.timestamp)
      }))
    }));
    
    // Ensure unique IDs for all chats
    const chatMap = new Map<string, Chat>();
    parsedChats.forEach((chat: Chat) => {
      if (!chatMap.has(chat.id)) {
        chatMap.set(chat.id, chat);
      }
    });
    
    // Convert map back to array and sort
    const uniqueChats = Array.from(chatMap.values());
    const sortedChats = uniqueChats.sort((a: Chat, b: Chat) => 
      b.updatedAt.getTime() - a.updatedAt.getTime()
    );
    
    setChats(sortedChats);
  }, [currentChat]);

  const deleteChat = (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Remove from localStorage
    const savedChats = JSON.parse(localStorage.getItem('assistantChats') || '[]');
    const updatedChats = savedChats.filter((chat: Chat) => chat.id !== chatId);
    localStorage.setItem('assistantChats', JSON.stringify(updatedChats));
    
    // Update state
    setChats(chats.filter(chat => chat.id !== chatId));
    
    toast({
      title: "Chat Deleted",
      description: "The conversation has been removed.",
    });
  };

  const filteredChats = chats.filter(chat => 
    chat.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    chat.messages.some(msg => msg.content.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="flex flex-col h-full">
      <div className="p-4">
        <Button 
          onClick={onNewChat} 
          className="w-full"
        >
          <PlusCircle className="mr-2 h-4 w-4" />
          New Chat
        </Button>
        
        <div className="relative mt-4">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>
      
      <Separator />
      
      <div className="flex-1 overflow-y-auto p-2">
        <h3 className="text-sm font-medium text-muted-foreground p-2">Recent Conversations</h3>
        
        {filteredChats.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            {searchQuery ? "No matching conversations found" : "No previous conversations"}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredChats.map((chat) => (
              <div
                key={chat.id}
                onClick={() => onChatSelect(chat.id)}
                className={`p-3 rounded-md cursor-pointer hover:bg-accent flex justify-between items-start ${
                  currentChat?.id === chat.id ? 'bg-accent' : ''
                }`}
              >
                <div className="truncate">
                  <div className="font-medium truncate">{chat.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {format(new Date(chat.updatedAt), 'MMM d, h:mm a')}
                  </div>
                  <div className="text-sm truncate text-muted-foreground">
                    {chat.messages[chat.messages.length - 1]?.content.slice(0, 50)}
                    {chat.messages[chat.messages.length - 1]?.content.length > 50 ? '...' : ''}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => deleteChat(chat.id, e)}
                  className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 hover:opacity-100"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AssistantChatSidebar;
