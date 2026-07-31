
import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";
import { Assistant } from "@/types/assistants";
import { createElement } from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface AssistantChatProps {
  assistant: Assistant | null;
  onClose: () => void;
}

export function AssistantChat({ assistant, onClose }: AssistantChatProps) {
  const [chatMessages, setChatMessages] = useState<Message[]>([
    { 
      role: 'assistant', 
      content: assistant ? `Hello! I'm here to help you build your career roadmap. Let's explore your career goals and create a path to achieve them.` : ''
    }
  ]);
  const [userInput, setUserInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Render the icon from the assistant object
  const renderIcon = () => {
    if (!assistant || !assistant.icon) return null;
    
    const { component, props } = assistant.icon;
    return createElement(component, props);
  };

  const handleSendMessage = () => {
    if (!userInput.trim()) return;
    
    const newMessages: Message[] = [
      ...chatMessages,
      { role: 'user' as const, content: userInput }
    ];
    
    setChatMessages(newMessages);
    setUserInput('');
    
    // Simulate assistant response after a short delay
    setTimeout(() => {
      setChatMessages([
        ...newMessages,
        { 
          role: 'assistant' as const, 
          content: "Based on what you've shared, let's explore career paths that align with your interests and goals. Would you like to discuss specific industries or roles you're interested in?"
        }
      ]);
    }, 1000);
  };
  
  return (
    <Dialog open={!!assistant} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px] h-[80vh] flex flex-col">
        <DialogHeader className="text-center pb-4 border-b">
          <div className="flex flex-col items-center gap-3">
            <Avatar className="h-16 w-16">
              {assistant && (
                <div className="bg-ss-lav-chip text-ss-lav-deep rounded-full p-4">
                  {renderIcon()}
                </div>
              )}
              <AvatarFallback>CA</AvatarFallback>
            </Avatar>
            <DialogTitle className="text-xl">Building Your Career Roadmap</DialogTitle>
          </div>
          <DialogDescription>
            Let's explore and plan your career journey together
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden my-4">
          <div className="h-full overflow-y-auto px-4 space-y-4">
            {chatMessages.map((message, index) => (
              <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`inline-block max-w-[80%] p-3 rounded-lg ${
                  message.role === 'user' 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-muted text-foreground'
                }`}>
                  {message.content}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>
        
        <DialogFooter className="flex items-center gap-2 pt-4 border-t">
          <div className="flex-1">
            <Input 
              placeholder="Type your message..." 
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              className="w-full"
            />
          </div>
          <Button 
            onClick={handleSendMessage}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Send className="h-4 w-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
