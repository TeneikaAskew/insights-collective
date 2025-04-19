
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Timeline } from "@/components/ui/timeline"; // Placeholder: you can create this later or replace with a div
import { ChevronRight } from "lucide-react";

const careerGoals = [
  { id: 1, title: "Become a Senior Data Scientist", description: "Focus on ML, AI & predictive analytics" },
  { id: 2, title: "Master Frontend Development", description: "React, Tailwind, and animation skills" },
  { id: 3, title: "UX Designer Certification", description: "Complete courses & build portfolio" },
];

const roadmap = [
  { id: 1, label: "Complete React fundamentals", date: "Q2 2025" },
  { id: 2, label: "Build portfolio projects", date: "Q3 2025" },
  { id: 3, label: "Apply for internships", date: "Q4 2025" },
  { id: 4, label: "Secure first job", date: "Q1 2026" },
];

const nextSteps = [
  { id: 1, title: "Complete your profile", action: "Update profile" },
  { id: 2, title: "Review career recommendations", action: "View suggestions" },
  { id: 3, title: "Schedule mentorship", action: "Book time" },
];

const savedCareers = [
  { id: 1, title: "Data Engineer" },
  { id: 2, title: "Product Manager" },
  { id: 3, title: "AI Researcher" },
];

const UserDashboard: React.FC = () => {
  return (
    <div className="container mx-auto p-6 max-w-4xl space-y-8 min-h-screen">
      <h1 className="text-4xl font-bold text-amber-600 mb-4">Dashboard</h1>
      <section>
        <h2 className="text-2xl font-semibold mb-2">Career Goals</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {careerGoals.map(goal => (
            <Card key={goal.id} className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader>
                <CardTitle>{goal.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{goal.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-2">Roadmap Timeline</h2>
        <div className="bg-white border rounded-lg p-4 shadow-inner">
          <ul className="space-y-4">
            {roadmap.map(item => (
              <li key={item.id} className="flex justify-between border border-amber-300 rounded-md p-3 bg-amber-50">
                <span className="font-medium">{item.label}</span>
                <span className="text-muted-foreground">{item.date}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-2">Next Steps</h2>
        <ul className="space-y-3">
          {nextSteps.map(step => (
            <li key={step.id} className="flex justify-between items-center border border-gray-300 rounded-md p-3 hover:bg-amber-50 transition">
              <span>{step.title}</span>
              <Button size="sm" variant="ghost" className="text-amber-500 hover:text-amber-600">
                {step.action} <ChevronRight />
              </Button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-2">Saved Careers & Resources</h2>
        <ul className="space-y-3">
          {savedCareers.map(career => (
            <li key={career.id} className="border border-gray-300 rounded-md p-4 hover:bg-amber-50 transition cursor-pointer">
              {career.title}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
};

export default UserDashboard;
