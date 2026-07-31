
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AssistantCard } from "./AssistantCard";
import { Assistant } from "@/types/assistants";

interface AssistantTabsProps {
  assistants: Assistant[];
  onLaunch: (assistant: Assistant) => void;
}

export function AssistantTabs({ assistants, onLaunch }: AssistantTabsProps) {
  return (
    <Tabs defaultValue="all" className="space-y-6">
      <TabsList className="bg-muted p-1 rounded-md">
        <TabsTrigger 
          value="all" 
          className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
        >
          All Assistants
        </TabsTrigger>
        <TabsTrigger 
          value="analytics" 
          className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
        >
          Analytics
        </TabsTrigger>
        <TabsTrigger 
          value="coding" 
          className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
        >
          Coding
        </TabsTrigger>
        <TabsTrigger 
          value="content" 
          className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
        >
          Content
        </TabsTrigger>
      </TabsList>
      
      <TabsContent value="all" className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {assistants.map((assistant) => (
            <AssistantCard 
              key={assistant.id} 
              assistant={assistant} 
              onLaunch={onLaunch}
            />
          ))}
        </div>
      </TabsContent>
      
      <TabsContent value="analytics" className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {assistants
            .filter(a => a.category === "analytics")
            .map((assistant) => (
              <AssistantCard 
                key={assistant.id} 
                assistant={assistant} 
                onLaunch={onLaunch}
              />
            ))}
        </div>
      </TabsContent>
      
      <TabsContent value="coding" className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {assistants
            .filter(a => a.category === "coding")
            .map((assistant) => (
              <AssistantCard 
                key={assistant.id} 
                assistant={assistant} 
                onLaunch={onLaunch}
              />
            ))}
        </div>
      </TabsContent>
      
      <TabsContent value="content" className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {assistants
            .filter(a => a.category === "content")
            .map((assistant) => (
              <AssistantCard 
                key={assistant.id} 
                assistant={assistant} 
                onLaunch={onLaunch}
              />
            ))}
        </div>
      </TabsContent>
    </Tabs>
  );
}
