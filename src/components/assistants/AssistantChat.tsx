
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";
import { Assistant } from "@/types/assistants";
import { createElement } from "react";

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
      content: assistant ? `Hello! I'm ${assistant.name}. How can I help you with ${assistant.category === 'career' ? 'finding your ideal career path' : assistant.category === 'analytics' ? 'data analysis' : assistant.category === 'coding' ? 'coding problems' : 'content creation'} today?` : ''
    }
  ]);
  const [userInput, setUserInput] = useState('');
  
  // Render the icon from the assistant object
  const renderIcon = () => {
    if (!assistant || !assistant.icon) return null;
    
    // Check if icon is in the format created by createIcon function
    if (typeof assistant.icon === 'object' && 'component' in assistant.icon && 'props' in assistant.icon) {
      const { component, props } = assistant.icon as any;
      return createElement(component, props);
    }
    
    // Fallback for any other icon format
    return assistant.icon;
  };

  const handleSendMessage = () => {
    if (!userInput.trim()) return;
    
    const newMessages = [
      ...chatMessages,
      { role: 'user', content: userInput }
    ];
    
    setChatMessages(newMessages);
    setUserInput('');
    
    // Simulate assistant response after a short delay
    setTimeout(() => {
      setChatMessages([
        ...newMessages,
        { 
          role: 'assistant', 
          content: assistant?.category === 'career'
            ? "Based on what I understand about your skills and interests, I'd recommend exploring roles that align with your analytical strengths. Would you like to know more about specific data careers that might be a good fit?"
            : "Thank you for your message. I'm here to help you with any questions related to " + assistant?.name + ". What specific assistance do you need today?"
        }
      ]);
    }, 1000);
  };
  
  return (
    <Dialog open={!!assistant} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {assistant && (
              <>
                <div className={`h-8 w-8 rounded-full ${assistant.category === 'career' ? 'bg-insightBlue/20 text-insightBlue' : 'bg-aquaTeal/20 text-insightBlue'} flex items-center justify-center`}>
                  {renderIcon()}
                </div>
                {assistant.name}
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {assistant?.description}
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto my-4 p-2 bg-slate-50 rounded-md max-h-[300px]">
          {chatMessages.map((message, index) => (
            <div key={index} className={`mb-3 ${message.role === 'user' ? 'text-right' : ''}`}>
              <div className={`inline-block max-w-[80%] p-3 rounded-lg ${
                message.role === 'user' 
                  ? 'bg-insightBlue text-white' 
                  : 'bg-gray-200 text-slateGray'
              }`}>
                {message.content}
              </div>
            </div>
          ))}
        </div>
        
        <DialogFooter className="flex items-center gap-2">
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
            className="bg-insightBlue hover:bg-insightBlue/90 text-white"
          >
            <Send className="h-4 w-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
