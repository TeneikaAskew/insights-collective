
import React from 'react';
import { TargetRole } from '@/types/portfolio';
import { RoleCard } from './RoleCard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ProjectIdeaListProps {
  targetRoles: TargetRole[];
  onAddProject: (projectIdea: any) => void;
}

export function ProjectIdeaList({ targetRoles, onAddProject }: ProjectIdeaListProps) {
  if (!targetRoles?.length) {
    return (
      <Card className="border-dashed border-2">
        <CardHeader>
          <CardTitle>No Roles Available</CardTitle>
          <CardDescription>
            Complete the questionnaire to see role-specific project recommendations.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recommended Career Paths</CardTitle>
        <CardDescription>
          Based on your profile, here are tailored roles and project ideas for your portfolio
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={targetRoles[0]?.title?.replace(/\s+/g, '-').toLowerCase() || "role-0"} className="w-full">
          <TabsList className="w-full mb-4">
            {targetRoles.map((role, index) => (
              <TabsTrigger 
                key={index} 
                value={role.title.replace(/\s+/g, '-').toLowerCase() || `role-${index}`}
                className="flex-1"
              >
                {role.title}
              </TabsTrigger>
            ))}
          </TabsList>
          
          {targetRoles.map((role, index) => (
            <TabsContent 
              key={index} 
              value={role.title.replace(/\s+/g, '-').toLowerCase() || `role-${index}`}
            >
              <RoleCard role={role} onAddProject={onAddProject} />
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
