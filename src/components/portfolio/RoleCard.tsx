import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TargetRole } from '@/types/portfolio';
import { Briefcase, Code, FileCheck } from 'lucide-react';

interface RoleCardProps {
  role: TargetRole;
  onAddProject: (projectIdea: any) => void;
}

export function RoleCard({ role, onAddProject }: RoleCardProps) {
  return (
    <Card className="w-full shadow-sm hover:shadow-md transition-shadow mb-4">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-xl flex items-center">
              <Briefcase className="h-5 w-5 mr-2 text-[#9b87f5]" />
              {role.title}
            </CardTitle>
            <CardDescription className="mt-1">
              {role.commonDeliverables.slice(0, 3).join(", ")}
              {role.commonDeliverables.length > 3 && "..."}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="flex flex-wrap gap-1 mb-3">
          {role.coreSkills.map((skill, idx) => (
            <Badge key={idx} variant="outline" className="bg-[#9b87f5]/10 text-[#9b87f5] border-[#9b87f5]/20">
              {skill}
            </Badge>
          ))}
        </div>

        <h4 className="font-medium text-sm mt-4 mb-2 flex items-center">
          <FileCheck className="h-4 w-4 mr-1 text-[#9b87f5]" />
          Common Deliverables
        </h4>
        <ul className="list-disc pl-5 text-sm text-gray-600 mb-4">
          {role.commonDeliverables.map((deliverable, idx) => (
            <li key={idx}>{deliverable}</li>
          ))}
        </ul>
        
        <h4 className="font-medium text-sm mt-4 mb-2 flex items-center">
          <Code className="h-4 w-4 mr-1 text-[#9b87f5]" /> 
          Project Ideas
        </h4>
        
        {role.projectIdeas.map((project, idx) => (
          <div key={idx} className="border rounded-lg p-3 mb-3 hover:border-[#9b87f5]/30 hover:bg-[#9b87f5]/5 transition-colors">
            <div className="flex justify-between items-start mb-1">
              <h5 className="font-medium text-sm">{project.title}</h5>
              <Button 
                size="sm" 
                variant="outline"
                className="h-7 text-xs border-[#9b87f5] text-[#9b87f5] hover:bg-[#9b87f5]/10"
                onClick={() => onAddProject(project)}
              >
                Add to Portfolio
              </Button>
            </div>
            <p className="text-xs text-gray-600 mb-2">{project.description}</p>
            <div className="flex flex-wrap gap-1 mt-1">
              <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-200 border-none text-xs">
                Effort: {project.effortLevel}
              </Badge>
              {project.requiredSkills.slice(0, 3).map((skill, i) => (
                <Badge key={i} variant="outline" className="text-xs">
                  {skill}
                </Badge>
              ))}
              {project.requiredSkills.length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{project.requiredSkills.length - 3} more
                </Badge>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
