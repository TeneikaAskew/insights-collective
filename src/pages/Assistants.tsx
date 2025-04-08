
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import { AssistantCard } from "@/components/assistants/AssistantCard";
import { AssistantTabs } from "@/components/assistants/AssistantTabs";
import { careerExplorerAssistant, allAssistants } from "@/data/assistantData";
import { Assistant } from "@/types/assistants";

export default function Assistants() {
  const [openAssistant, setOpenAssistant] = useState<Assistant | null>(null);
  const navigate = useNavigate();
  
  const handleLaunchAssistant = (assistant: Assistant) => {
    // Navigate to the dedicated assistant interface with the assistant data
    navigate(`/assistant/${assistant.id}`, { state: { assistant } });
  };
  
  return (
    <AppLayout>
      <div className="space-y-6 py-6">
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
    </AppLayout>
  );
}
