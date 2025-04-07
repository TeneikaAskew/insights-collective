
import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { ThemeText } from "@/components/ui/theme-text";
import { AssistantCard } from "@/components/assistants/AssistantCard";
import { AssistantChat } from "@/components/assistants/AssistantChat";
import { AssistantTabs } from "@/components/assistants/AssistantTabs";
import { careerExplorerAssistant, allAssistants } from "@/data/assistantData";
import { Assistant } from "@/types/assistants";

export default function Assistants() {
  const [openAssistant, setOpenAssistant] = useState<Assistant | null>(null);
  
  const handleLaunchAssistant = (assistant: Assistant) => {
    setOpenAssistant(assistant);
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
        
        <AssistantTabs 
          assistants={allAssistants} 
          onLaunch={handleLaunchAssistant}
        />
      </div>
      
      {/* Assistant Chat Dialog */}
      <AssistantChat 
        assistant={openAssistant} 
        onClose={() => setOpenAssistant(null)}
      />
    </AppLayout>
  );
}
