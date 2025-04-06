
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar } from '@/components/ui/avatar';
import LoginWall from '@/components/common/LoginWall';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import AppLayout from '@/components/layout/AppLayout';
import { Send, BrainCircuit, Code, RefreshCcw, User } from 'lucide-react';
import { quizQuestions, trackPersonas } from '@/data/careerQuizData';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
};

type AssistantType = 'career' | 'technical';

const Assistants = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [careerMessages, setCareerMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hello! I\'m your Career Explorer assistant. I can help you discover career paths that align with your interests, skills, and values. Feel free to share what you enjoy doing, what you dislike, or any specific roles you\'re curious about.',
      timestamp: new Date(),
    }
  ]);
  const [technicalMessages, setTechnicalMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hi there! I\'m your Code & Analytics Assistant. Whether you need help with coding tasks, data analysis, or technical questions, I\'m here to help. What are you working on today?',
      timestamp: new Date(),
    }
  ]);
  const [newMessage, setNewMessage] = useState('');
  const [currentAssistant, setCurrentAssistant] = useState<AssistantType>('career');
  const [isLoading, setIsLoading] = useState(false);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    const scrollAreas = document.querySelectorAll('.scroll-area-viewport');
    scrollAreas.forEach(area => {
      if (area instanceof HTMLElement) {
        area.scrollTop = area.scrollHeight;
      }
    });
  }, [careerMessages, technicalMessages]);

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;
    
    const id = Date.now().toString();
    const userMessage: Message = {
      id,
      role: 'user',
      content: newMessage,
      timestamp: new Date(),
    };
    
    // Update the appropriate message list
    if (currentAssistant === 'career') {
      setCareerMessages(prev => [...prev, userMessage]);
    } else {
      setTechnicalMessages(prev => [...prev, userMessage]);
    }
    
    setNewMessage('');
    setIsLoading(true);
    
    // Simulate AI response
    setTimeout(() => {
      const responseContent = generateMockResponse(newMessage, currentAssistant);
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: responseContent,
        timestamp: new Date(),
      };
      
      if (currentAssistant === 'career') {
        setCareerMessages(prev => [...prev, aiResponse]);
      } else {
        setTechnicalMessages(prev => [...prev, aiResponse]);
      }
      
      setIsLoading(false);
    }, 1500);
  };

  const generateMockResponse = (message: string, assistantType: AssistantType): string => {
    // This is a mock function - in a real implementation, you would call an actual AI model API
    if (assistantType === 'career') {
      if (message.toLowerCase().includes('data science')) {
        return "Based on your interest in data science, you might enjoy roles like Data Scientist, Machine Learning Engineer, or Data Analyst. These roles combine technical skills with business problem-solving. Would you like to explore any of these specific paths further?";
      } else if (message.toLowerCase().includes('like') || message.toLowerCase().includes('enjoy')) {
        return "Thanks for sharing what you enjoy! Interests are a key factor in career satisfaction. Based on this, you might want to explore roles that leverage these strengths. Would you like me to suggest some specific career paths that align with these interests?";
      } else {
        return "That's valuable information for your career exploration. To provide more tailored suggestions, could you share a bit about what aspects of work you find most energizing? For example, do you prefer analytical tasks, creative problem-solving, or perhaps working directly with people?";
      }
    } else {
      if (message.toLowerCase().includes('python')) {
        return "For Python-related tasks, I'd be happy to help! Python is excellent for data science, web development, automation, and more. Do you have a specific Python problem or concept you're working with?";
      } else if (message.toLowerCase().includes('data')) {
        return "When working with data, it's important to consider your analysis goals. Are you trying to explore patterns, build predictive models, or create visualizations? Each approach requires different tools and techniques. Could you share more about your specific data challenge?";
      } else {
        return "I'd be happy to help with your technical question. To provide the most accurate guidance, could you share more details about your project requirements, what you've tried so far, or any specific libraries/frameworks you're using?";
      }
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const resetConversation = (assistantType: AssistantType) => {
    const initialMessage = {
      id: Date.now().toString(),
      role: 'assistant' as const,
      content: assistantType === 'career'
        ? 'Hello! I\'m your Career Explorer assistant. I can help you discover career paths that align with your interests, skills, and values. Feel free to share what you enjoy doing, what you dislike, or any specific roles you\'re curious about.'
        : 'Hi there! I\'m your Code & Analytics Assistant. Whether you need help with coding tasks, data analysis, or technical questions, I\'m here to help. What are you working on today?',
      timestamp: new Date(),
    };
    
    if (assistantType === 'career') {
      setCareerMessages([initialMessage]);
    } else {
      setTechnicalMessages([initialMessage]);
    }
  };

  // If not authenticated, show login wall
  if (!isAuthenticated) {
    return (
      <AppLayout>
        <div className="container mx-auto py-16 px-4">
          <Card className="max-w-3xl mx-auto">
            <CardHeader>
              <CardTitle>AI Assistants</CardTitle>
              <CardDescription>
                Get personalized career guidance and technical support
              </CardDescription>
            </CardHeader>
            <CardContent>
              <LoginWall
                message="Sign in or create an account to access AI assistants that provide personalized career guidance and technical support."
                visibleItems={0}
                totalItems={2}
              />
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container mx-auto py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-bold">AI Assistants</h1>
            <p className="text-muted-foreground">Get personalized career guidance and technical support from our AI assistants</p>
          </div>
          
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Career Assistant */}
            <Card className="overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/50 dark:to-purple-950/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                    <BrainCircuit className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">Career Explorer</CardTitle>
                    <CardDescription>Find your ideal career path</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="flex flex-col h-[550px]">
                  <ScrollArea className="flex-1 p-4">
                    <div className="space-y-4">
                      {careerMessages.map((message) => (
                        <div 
                          key={message.id} 
                          className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div className={`flex gap-3 max-w-[80%] ${message.role === 'user' ? 'flex-row-reverse' : ''}`}>
                            <Avatar className={`h-8 w-8 ${message.role === 'assistant' ? 'bg-indigo-100' : 'bg-primary/10'}`}>
                              {message.role === 'assistant' ? (
                                <BrainCircuit className="h-4 w-4 text-indigo-600" />
                              ) : (
                                <User className="h-4 w-4 text-primary" />
                              )}
                            </Avatar>
                            <div className={`rounded-lg px-4 py-2 text-sm ${
                              message.role === 'assistant' 
                                ? 'bg-muted text-foreground' 
                                : 'bg-primary text-primary-foreground'
                            }`}>
                              {message.content}
                            </div>
                          </div>
                        </div>
                      ))}
                      {isLoading && currentAssistant === 'career' && (
                        <div className="flex justify-start">
                          <div className="flex gap-3 max-w-[80%]">
                            <Avatar className="h-8 w-8 bg-indigo-100">
                              <BrainCircuit className="h-4 w-4 text-indigo-600" />
                            </Avatar>
                            <div className="rounded-lg px-4 py-2 text-sm bg-muted text-foreground">
                              <div className="flex space-x-2">
                                <div className="w-2 h-2 rounded-full bg-gray-400 animate-pulse"></div>
                                <div className="w-2 h-2 rounded-full bg-gray-400 animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                                <div className="w-2 h-2 rounded-full bg-gray-400 animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                  <div className="p-4 border-t">
                    <div className="flex gap-2">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => resetConversation('career')}
                        title="Reset conversation"
                      >
                        <RefreshCcw className="h-4 w-4" />
                      </Button>
                      <Textarea
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyDown={handleKeyPress}
                        placeholder="Ask about career paths, roles, or your strengths..."
                        className={`flex-1 resize-none ${currentAssistant !== 'career' ? 'opacity-60' : ''}`}
                        disabled={currentAssistant !== 'career' || isLoading}
                        onClick={() => setCurrentAssistant('career')}
                        rows={1}
                      />
                      <Button 
                        onClick={handleSendMessage} 
                        size="icon" 
                        disabled={!newMessage.trim() || isLoading || currentAssistant !== 'career'}
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Technical Assistant */}
            <Card className="overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/50 dark:to-cyan-950/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                    <Code className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">Code + Analytics Assistant</CardTitle>
                    <CardDescription>Get help with technical questions</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="flex flex-col h-[550px]">
                  <ScrollArea className="flex-1 p-4">
                    <div className="space-y-4">
                      {technicalMessages.map((message) => (
                        <div 
                          key={message.id} 
                          className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div className={`flex gap-3 max-w-[80%] ${message.role === 'user' ? 'flex-row-reverse' : ''}`}>
                            <Avatar className={`h-8 w-8 ${message.role === 'assistant' ? 'bg-blue-100' : 'bg-primary/10'}`}>
                              {message.role === 'assistant' ? (
                                <Code className="h-4 w-4 text-blue-600" />
                              ) : (
                                <User className="h-4 w-4 text-primary" />
                              )}
                            </Avatar>
                            <div className={`rounded-lg px-4 py-2 text-sm ${
                              message.role === 'assistant' 
                                ? 'bg-muted text-foreground' 
                                : 'bg-primary text-primary-foreground'
                            }`}>
                              {message.content}
                            </div>
                          </div>
                        </div>
                      ))}
                      {isLoading && currentAssistant === 'technical' && (
                        <div className="flex justify-start">
                          <div className="flex gap-3 max-w-[80%]">
                            <Avatar className="h-8 w-8 bg-blue-100">
                              <Code className="h-4 w-4 text-blue-600" />
                            </Avatar>
                            <div className="rounded-lg px-4 py-2 text-sm bg-muted text-foreground">
                              <div className="flex space-x-2">
                                <div className="w-2 h-2 rounded-full bg-gray-400 animate-pulse"></div>
                                <div className="w-2 h-2 rounded-full bg-gray-400 animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                                <div className="w-2 h-2 rounded-full bg-gray-400 animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                  <div className="p-4 border-t">
                    <div className="flex gap-2">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => resetConversation('technical')}
                        title="Reset conversation"
                      >
                        <RefreshCcw className="h-4 w-4" />
                      </Button>
                      <Textarea
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyDown={handleKeyPress}
                        placeholder="Ask about code, data analysis, or technical concepts..."
                        className={`flex-1 resize-none ${currentAssistant !== 'technical' ? 'opacity-60' : ''}`}
                        disabled={currentAssistant !== 'technical' || isLoading}
                        onClick={() => setCurrentAssistant('technical')}
                        rows={1}
                      />
                      <Button 
                        onClick={handleSendMessage} 
                        size="icon" 
                        disabled={!newMessage.trim() || isLoading || currentAssistant !== 'technical'}
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Assistants;
