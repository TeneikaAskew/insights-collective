
import React, { useState } from "react";
import { ChevronLeft } from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import HeatmapChart from "@/components/role-explorer/HeatmapChart";
import CareerFlowChart from "@/components/role-explorer/CareerFlowChart";

// Sample data for heatmap: roles vs industries demand (mocked numbers for illustration)
const industries = [
  "Finance & Banking",
  "Healthcare & Life Sciences",
  "Marketing & Advertising",
  "Retail & E-commerce",
  "Manufacturing",
  "Logistics & Supply Chain",
  "Energy & Utilities",
  "Government & Public Sector",
  "Education",
  "Entertainment & Media",
  "Insurance",
  "Telecommunications",
  "Real Estate",
  "Agriculture",
  "Transportation",
  "Hospitality & Tourism",
];

const roles = [
  "AI/ML Engineer",
  "Data Analyst",
  "Business Intelligence Specialist",
  "Data Engineer",
  "Data Architect",
  "Data Scientist",
  "MLOps Engineer",
  "Data Governance Specialist",
];

// Example heatmap data with demand intensity (0-100 scale)
const heatmapData = roles.map((role) => {
  const entry: Record<string, string | number> = { role };
  industries.forEach((industry) => {
    // Random demand value, replace with real data from your data source
    entry[industry] = 10 + Math.floor(Math.random() * 90);
  });
  return entry;
});

// Career flow nodes and links example for AI/ML Engineer career progression
const careerFlowNodes = [
  { id: "junior", label: "Junior AI/ML Engineer", x: 60, y: 70 },
  { id: "mid", label: "Mid-level AI/ML Engineer", x: 320, y: 70 },
  { id: "senior", label: "Senior AI/ML Engineer", x: 580, y: 70 },
  { id: "lead", label: "Lead AI/ML Engineer", x: 840, y: 70 },
];
const careerFlowLinks = [
  { source: "junior", target: "mid" },
  { source: "mid", target: "senior" },
  { source: "senior", target: "lead" },
];

const RoleExplorer: React.FC = () => {
  const [selectedCareerNode, setSelectedCareerNode] = useState<string | null>(null);

  return (
    <AppLayout>
      <div className="container mx-auto p-8 space-y-10">
        <header className="mb-6">
          <h1 className="text-4xl font-bold text-energeticAmber">Role Explorer</h1>
          <p className="max-w-3xl text-muted-foreground mt-2">
            Explore data career roles and their industry demand. Visualize career progressions and role intersections.
          </p>
          <Button
            variant="ghost"
            className="mt-4"
            onClick={() => setSelectedCareerNode(null)}
            aria-label="Reset career node selection"
          >
            <ChevronLeft className="w-5 h-5 mr-2" />
            Reset Selection
          </Button>
        </header>

        <Tabs defaultValue="heatmap" className="space-y-6">
          <TabsList className="bg-aquaTeal/10 rounded-lg p-1">
            <TabsTrigger
              value="heatmap"
              className="data-[state=active]:bg-insightBlue data-[state=active]:text-white rounded-md"
            >
              Role-to-Industry Heatmap
            </TabsTrigger>
            <TabsTrigger
              value="careerFlow"
              className="data-[state=active]:bg-insightBlue data-[state=active]:text-white rounded-md"
            >
              Career Journey Flow
            </TabsTrigger>
          </TabsList>

          <TabsContent value="heatmap" className="overflow-x-auto">
            <HeatmapChart data={heatmapData} industries={industries} roles={roles} />
          </TabsContent>

          <TabsContent value="careerFlow" className="overflow-auto">
            <CareerFlowChart
              nodes={careerFlowNodes}
              links={careerFlowLinks}
              selectedNodeId={selectedCareerNode}
              onSelectNode={setSelectedCareerNode}
            />
            {selectedCareerNode && (
              <div
                tabIndex={0}
                aria-live="polite"
                className="mt-6 max-w-4xl bg-card text-card-foreground p-4 rounded-md shadow"
              >
                <h2 className="text-xl font-semibold mb-2">Career Step Details</h2>
                <p>Selected node ID: {selectedCareerNode}</p>
                {/* Ideally render detailed info related to the selected node */}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default RoleExplorer;
