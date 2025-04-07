
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Bot, Sparkles, Cpu, Code, PieChart, Text, Video, RefreshCw, BookOpen, Brain, Compass, Lightbulb, Send } from "lucide-react";
import { ThemeText } from "@/components/ui/theme-text";

export default function Assistants() {
  const [openAssistant, setOpenAssistant] = useState<Assistant | null>(null);
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant', content: string }[]>([]);
  const [userInput, setUserInput] = useState('');
  
  const handleLaunchAssistant = (assistant: Assistant) => {
    setOpenAssistant(assistant);
    setChatMessages([
      { 
        role: 'assistant' as const, 
        content: `Hello! I'm ${assistant.name}. How can I help you with ${assistant.category === 'career' ? 'finding your ideal career path' : assistant.category === 'analytics' ? 'data analysis' : assistant.category === 'coding' ? 'coding problems' : 'content creation'} today?`
      }
    ]);
  };
  
  const handleSendMessage = () => {
    if (!userInput.trim()) return;
    
    const newMessages = [
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
          content: openAssistant?.category === 'career'
            ? "Based on what I understand about your skills and interests, I'd recommend exploring roles that align with your analytical strengths. Would you like to know more about specific data careers that might be a good fit?"
            : "Thank you for your message. I'm here to help you with any questions related to " + openAssistant?.name + ". What specific assistance do you need today?"
        }
      ]);
    }, 1000);
  };
  
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI Assistants</h1>
          <p className="text-muted-foreground mt-2">
            Use our specialized AI assistants to enhance your learning experience.
          </p>
        </div>
        
        {/* Featured Assistant */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Featured Assistant</h2>
          <AssistantCard 
            assistant={careerExplorerAssistant} 
            featured={true} 
            onLaunch={handleLaunchAssistant}
          />
        </div>
        
        <Tabs defaultValue="all" className="space-y-6">
          <TabsList className="bg-aquaTeal/10">
            <TabsTrigger 
              value="all" 
              className="data-[state=active]:bg-energeticAmber data-[state=active]:text-white"
            >
              All Assistants
            </TabsTrigger>
            <TabsTrigger 
              value="analytics" 
              className="data-[state=active]:bg-energeticAmber data-[state=active]:text-white"
            >
              Analytics
            </TabsTrigger>
            <TabsTrigger 
              value="coding" 
              className="data-[state=active]:bg-energeticAmber data-[state=active]:text-white"
            >
              Coding
            </TabsTrigger>
            <TabsTrigger 
              value="content" 
              className="data-[state=active]:bg-energeticAmber data-[state=active]:text-white"
            >
              Content
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="all" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {allAssistants.map((assistant) => (
                <AssistantCard 
                  key={assistant.id} 
                  assistant={assistant} 
                  onLaunch={handleLaunchAssistant}
                />
              ))}
            </div>
          </TabsContent>
          
          <TabsContent value="analytics" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {allAssistants
                .filter(a => a.category === "analytics")
                .map((assistant) => (
                  <AssistantCard 
                    key={assistant.id} 
                    assistant={assistant} 
                    onLaunch={handleLaunchAssistant}
                  />
                ))}
            </div>
          </TabsContent>
          
          <TabsContent value="coding" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {allAssistants
                .filter(a => a.category === "coding")
                .map((assistant) => (
                  <AssistantCard 
                    key={assistant.id} 
                    assistant={assistant} 
                    onLaunch={handleLaunchAssistant}
                  />
                ))}
            </div>
          </TabsContent>
          
          <TabsContent value="content" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {allAssistants
                .filter(a => a.category === "content")
                .map((assistant) => (
                  <AssistantCard 
                    key={assistant.id} 
                    assistant={assistant} 
                    onLaunch={handleLaunchAssistant}
                  />
                ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
      
      {/* Assistant Chat Dialog */}
      {openAssistant && (
        <Dialog open={!!openAssistant} onOpenChange={(open) => !open && setOpenAssistant(null)}>
          <DialogContent className="sm:max-w-[500px] max-h-[80vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <div className={`h-8 w-8 rounded-full ${openAssistant.category === 'career' ? 'bg-insightBlue/20 text-insightBlue' : 'bg-aquaTeal/20 text-insightBlue'} flex items-center justify-center`}>
                  {openAssistant.icon}
                </div>
                {openAssistant.name}
              </DialogTitle>
              <DialogDescription>
                {openAssistant.description}
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
      )}
    </AppLayout>
  );
}

type Assistant = {
  id: string;
  name: string;
  icon: React.ReactNode;
  description: string;
  category: "analytics" | "coding" | "content" | "career";
  popular?: boolean;
};

const AssistantCard = ({ 
  assistant, 
  featured = false, 
  onLaunch 
}: { 
  assistant: Assistant, 
  featured?: boolean,
  onLaunch: (assistant: Assistant) => void 
}) => {
  return (
    <Card className={`h-full flex flex-col card-hover ${featured ? 'border-2 border-insightBlue' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between mb-2">
          <div className={`h-10 w-10 rounded-full ${featured ? 'bg-insightBlue/20 text-insightBlue' : 'bg-aquaTeal/20 text-insightBlue'} flex items-center justify-center`}>
            {assistant.icon}
          </div>
          {(assistant.popular || featured) && (
            <div className={`px-2 py-1 ${featured ? 'bg-insightBlue/20 text-viraDeepBlue' : 'bg-aquaTeal/20 text-viraDeepBlue'} text-xs font-medium rounded-full`}>
              {featured ? 'Featured' : 'Popular'}
            </div>
          )}
        </div>
        <CardTitle className="text-xl">{assistant.name}</CardTitle>
        <CardDescription className={`${featured ? 'line-clamp-none' : 'line-clamp-2'}`}>
          {assistant.description}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow">
        <ul className="space-y-2 text-sm">
          {featured ? (
            <>
              <li className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-energeticAmber" />
                <span>Personalized career recommendations</span>
              </li>
              <li className="flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-energeticAmber" />
                <span>Considers quiz results & chat input</span>
              </li>
              <li className="flex items-center gap-2">
                <Compass className="h-4 w-4 text-energeticAmber" />
                <span>Acts as your personal career coach</span>
              </li>
              <li className="flex items-center gap-2">
                <Brain className="h-4 w-4 text-energeticAmber" />
                <span>Pre-loaded with skills/interest data</span>
              </li>
            </>
          ) : (
            <>
              <li className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-energeticAmber" />
                <span>Smart recommendations</span>
              </li>
              <li className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-energeticAmber" />
                <span>Unlimited queries</span>
              </li>
              <li className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-energeticAmber" />
                <span>Learning-centered design</span>
              </li>
            </>
          )}
        </ul>
      </CardContent>
      <CardFooter>
        <Button 
          className={`w-full ${featured ? 'bg-gradient-to-r from-energeticAmber to-insightBlue hover:from-energeticAmber/90 hover:to-insightBlue/90' : 'bg-gradient-to-r from-insightBlue to-aquaTeal hover:from-insightBlue/90 hover:to-aquaTeal/90'} text-white`}
          onClick={() => onLaunch(assistant)}
        >
          Launch Assistant
        </Button>
      </CardFooter>
    </Card>
  );
};

// Career Explorer Assistant definition (featured)
const careerExplorerAssistant: Assistant = {
  id: "0",
  name: "Career Discovery GPT",
  icon: <Compass className="h-5 w-5" />,
  description: "Your personalized career guide in data science and analytics. This assistant analyzes your quiz results, skills, interests, and values to recommend ideal career paths. It acts as your career coach, providing insights into aligned roles and learning paths.",
  category: "career",
  popular: true,
};

const allAssistants: Assistant[] = [
  {
    id: "1",
    name: "Data Analyst",
    icon: <PieChart className="h-5 w-5" />,
    description: "Get help with data analysis, visualization, and interpretation.",
    category: "analytics",
    popular: true,
  },
  {
    id: "2",
    name: "Code Companion",
    icon: <Code className="h-5 w-5" />,
    description: "Assistance with coding problems, debugging and optimization.",
    category: "coding",
    popular: true,
  },
  {
    id: "3",
    name: "Study Guide Creator",
    icon: <BookOpen className="h-5 w-5" />,
    description: "Generate personalized study guides based on your learning goals.",
    category: "content",
  },
  {
    id: "4",
    name: "Algorithm Tutor",
    icon: <Brain className="h-5 w-5" />,
    description: "Learn algorithms and data structures with step-by-step explanations.",
    category: "coding",
  },
  {
    id: "5",
    name: "Data Visualization Expert",
    icon: <PieChart className="h-5 w-5" />,
    description: "Turn your data into compelling visualizations with expert guidance.",
    category: "analytics",
  },
  {
    id: "6",
    name: "Content Summarizer",
    icon: <Text className="h-5 w-5" />,
    description: "Summarize articles, papers, and learning materials for quick review.",
    category: "content",
  },
  {
    id: "7",
    name: "Machine Learning Guide",
    icon: <Cpu className="h-5 w-5" />,
    description: "Guidance on building and optimizing machine learning models.",
    category: "analytics",
  },
  {
    id: "8",
    name: "Video Tutorial Finder",
    icon: <Video className="h-5 w-5" />,
    description: "Discover the best video tutorials for any data science topic.",
    category: "content",
  },
  {
    id: "9",
    name: "Python Helper",
    icon: <Code className="h-5 w-5" />,
    description: "Get help with Python programming for data science applications.",
    category: "coding",
  },
];
