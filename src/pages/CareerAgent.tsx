
import { useState, useRef, useEffect } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CircleUser } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function CareerAgent() {
  const [messages, setMessages] = useState<Message[]>([
    { 
      role: 'assistant',
      content: "Hello! I'm here to help you build your career roadmap. Let's explore your career goals and create a path to achieve them."
    }
  ]);
  const [userInput, setUserInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = () => {
    if (!userInput.trim()) return;

    const newMessages = [
      ...messages,
      { role: 'user', content: userInput }
    ];

    setMessages(newMessages);
    setUserInput('');

    // Simulate assistant response
    setTimeout(() => {
      setMessages([
        ...newMessages,
        {
          role: 'assistant',
          content: "Based on what you've shared, let's explore career paths that align with your interests and goals. Would you like to discuss specific industries or roles you're interested in?"
        }
      ]);
    }, 1000);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-3xl mx-auto">
      <div className="flex items-center justify-center gap-3 p-4 border-b">
        <Avatar className="h-12 w-12">
          <div className="bg-insightBlue/20 text-insightBlue rounded-full p-3">
            <CircleUser className="h-6 w-6" />
          </div>
          <AvatarFallback>CA</AvatarFallback>
        </Avatar>
        <div className="text-center">
          <h1 className="text-xl font-semibold">Building Your Career Roadmap</h1>
          <p className="text-sm text-gray-500">Let's explore and plan your career journey together</p>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto px-4 py-6 space-y-4 scrollbar-none">
          {messages.map((message, index) => (
            <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`inline-block max-w-[80%] p-3 rounded-lg ${
                message.role === 'user' 
                  ? 'bg-insightBlue text-white' 
                  : 'bg-slate-100 text-slate-800'
              }`}>
                {message.content}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="p-4 border-t bg-white">
        <div className="flex gap-2">
          <Input
            placeholder="Type your message..."
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            className="flex-1"
          />
          <Button
            onClick={handleSendMessage}
            className="bg-insightBlue hover:bg-insightBlue/90 text-white"
          >
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}
