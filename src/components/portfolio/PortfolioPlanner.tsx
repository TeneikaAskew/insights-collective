
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, ArrowRight, Clock, BarChart } from 'lucide-react';
import { ProjectIdea, UserProject } from '@/hooks/usePortfolioExplorer';
import KanbanBoard from '@/components/portfolio/KanbanBoard';

interface PortfolioPlannerProps {
  projectIdeas: ProjectIdea[];
  userProjects: UserProject[];
  onAddProject: (project: ProjectIdea) => void;
  onUpdateStatus: (projectId: string, newStatus: 'Idea' | 'Planned' | 'In Progress' | 'Completed') => void;
}

const PortfolioPlanner: React.FC<PortfolioPlannerProps> = ({ 
  projectIdeas, 
  userProjects,
  onAddProject,
  onUpdateStatus
}) => {
  const [selectedRole, setSelectedRole] = useState<string | null>(
    projectIdeas.length > 0 ? projectIdeas[0].roleTitle : null
  );
  
  const filteredIdeas = selectedRole 
    ? projectIdeas.filter(idea => idea.roleTitle === selectedRole)
    : projectIdeas;
    
  const uniqueRoles = Array.from(new Set(projectIdeas.map(idea => idea.roleTitle)));

  return (
    <div className="space-y-8">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-2xl font-semibold mb-4">Portfolio Project Planner</h2>
        <p className="text-gray-600 dark:text-gray-300">
          Browse project ideas for each career path and add them to your portfolio.
          Then use the Kanban board to track your progress.
        </p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Project Ideas Panel */}
        <div className="lg:col-span-1">
          <Card className="h-full flex flex-col">
            <CardHeader>
              <CardTitle>Project Ideas</CardTitle>
              <CardDescription>
                Recommended projects based on your profile
              </CardDescription>
              
              {uniqueRoles.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {uniqueRoles.map(role => (
                    <Badge 
                      key={role}
                      variant={selectedRole === role ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => setSelectedRole(role)}
                    >
                      {role}
                    </Badge>
                  ))}
                </div>
              )}
            </CardHeader>
            
            <CardContent className="flex-grow overflow-auto max-h-[600px]">
              {filteredIdeas.length > 0 ? (
                <div className="space-y-4">
                  {filteredIdeas.map((idea) => {
                    // Check if project is already added to user projects
                    const isAdded = userProjects.some(p => p.title === idea.title);
                    
                    return (
                      <Card key={idea.id} className={`border ${isAdded ? 'border-green-500' : ''}`}>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-lg">{idea.title}</CardTitle>
                        </CardHeader>
                        <CardContent className="pb-2">
                          <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                            {idea.description}
                          </p>
                          
                          <div className="flex items-center text-xs text-gray-500 mb-2">
                            <Clock className="h-3 w-3 mr-1" />
                            <span>{idea.effortLevel}</span>
                          </div>
                          
                          <div className="flex items-center text-xs text-gray-500 mb-3">
                            <BarChart className="h-3 w-3 mr-1" />
                            <span>{idea.impact}</span>
                          </div>
                          
                          <div className="flex flex-wrap gap-1">
                            {idea.requiredSkills.map((skill) => (
                              <Badge key={skill} variant="outline" className="text-xs">
                                {skill}
                              </Badge>
                            ))}
                          </div>
                        </CardContent>
                        <CardFooter>
                          <Button 
                            variant={isAdded ? "secondary" : "default"}
                            size="sm"
                            className="w-full"
                            onClick={() => !isAdded && onAddProject(idea)}
                            disabled={isAdded}
                          >
                            {isAdded ? 'Added to Portfolio' : (
                              <>
                                <Plus className="h-4 w-4 mr-1" />
                                Add to Portfolio
                              </>
                            )}
                          </Button>
                        </CardFooter>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  {projectIdeas.length === 0 ? (
                    <p>No project ideas available. Complete your profile first.</p>
                  ) : (
                    <p>No projects for the selected role.</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        
        {/* Kanban Board */}
        <div className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Your Portfolio Projects</CardTitle>
              <CardDescription>
                Drag projects between columns to update their status
              </CardDescription>
            </CardHeader>
            <CardContent className="h-[600px] overflow-auto">
              <KanbanBoard 
                projects={userProjects}
                onUpdateStatus={onUpdateStatus}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default PortfolioPlanner;
