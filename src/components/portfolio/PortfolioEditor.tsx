
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePortfolioPages } from '@/hooks/usePortfolioPages';
import { usePortfolio } from '@/hooks/usePortfolio';
import {
  Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { 
  DragDropContext, Droppable, Draggable, DropResult
} from 'react-beautiful-dnd';
import { PortfolioProject, PortfolioPageProject } from '@/types/portfolio';
import { ArrowLeft, Check, Edit, Trash, MoveVertical, Plus, FileCheck, X } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function PortfolioEditor() {
  const { pageId } = useParams<{ pageId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { usePortfolioPageWithProjects, addProjectToPage, removeProjectFromPage, updatePortfolioPageProject } = usePortfolioPages();
  const { projects, projectsLoading } = usePortfolio();
  
  const { data: portfolioPage, isLoading: pageLoading, refetch: refetchPortfolioPage } = usePortfolioPageWithProjects(pageId);
  const [addProjectDialogOpen, setAddProjectDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<PortfolioPageProject | null>(null);
  const [customDescription, setCustomDescription] = useState('');

  // Set up real-time subscription for portfolio project updates
  useEffect(() => {
    if (!user?.id) return;

    console.log('Setting up real-time subscription for portfolio projects');

    const channel = supabase
      .channel('portfolio-projects-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'portfolio_projects',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('Portfolio project changed:', payload);
          // Refetch the portfolio page to get updated project data
          refetchPortfolioPage();
        }
      )
      .subscribe();

    return () => {
      console.log('Cleaning up real-time subscription');
      supabase.removeChannel(channel);
    };
  }, [user?.id, refetchPortfolioPage]);
  
  const handleAddProject = async (project: PortfolioProject) => {
    if (!pageId) return;
    await addProjectToPage.mutateAsync({
      pageId,
      projectId: project.id
    });
    setAddProjectDialogOpen(false);
  };
  
  const handleRemoveProject = async (projectId: string) => {
    if (!pageId) return;
    await removeProjectFromPage.mutateAsync({
      pageId,
      projectId
    });
  };
  
  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;
    
    if (!destination) {
      return;
    }
    
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }
    
    if (!portfolioPage?.projects) return;
    
    // Create a copy of projects array
    const newProjects = [...portfolioPage.projects];
    
    // Find the project being dragged
    const draggedProject = newProjects.find(p => p.id === draggableId);
    if (!draggedProject) return;
    
    // Remove the project from its original position
    newProjects.splice(source.index, 1);
    
    // Insert the project at its new position
    newProjects.splice(destination.index, 0, draggedProject);
    
    // Update display orders for all projects
    for (let i = 0; i < newProjects.length; i++) {
      // Only update if the order has changed
      if (newProjects[i].display_order !== i) {
        await updatePortfolioPageProject.mutateAsync({
          pageId: pageId!,
          projectId: newProjects[i].project_id,
          displayOrder: i
        });
      }
    }
  };
  
  const handleEditProject = (project: PortfolioPageProject) => {
    setEditingProject(project);
    setCustomDescription(project.custom_description || project.project?.description || '');
  };
  
  const saveCustomDescription = async () => {
    if (!editingProject || !pageId) return;
    
    await updatePortfolioPageProject.mutateAsync({
      pageId,
      projectId: editingProject.project_id,
      customDescription
    });
    
    setEditingProject(null);
  };
  
  // Filter projects that are not already in the portfolio page
  const getAvailableProjects = () => {
    if (!projects || !portfolioPage?.projects) return [];
    
    // Get IDs of projects already in the portfolio page
    const existingProjectIds = new Set(portfolioPage.projects.map(p => p.project_id));
    
    // Filter projects that are completed and not already added
    return projects.filter(p => 
      p.status === 'Completed' && !existingProjectIds.has(p.id)
    );
  };
  
  if (pageLoading) {
    return (
      <div className="flex justify-center items-center h-96">
        <Spinner size="lg" />
      </div>
    );
  }
  
  if (!portfolioPage) {
    return (
      <Card className="my-6">
        <CardContent className="py-10">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">Portfolio page not found</h2>
            <p className="text-gray-500 mb-6">The portfolio page you're looking for doesn't exist or you don't have permission to view it.</p>
            <Button onClick={() => navigate('/portfolio-explorer')}>
              Back to Portfolio Explorer
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  const availableProjects = getAvailableProjects();
  
  return (
    <div className="container mx-auto p-4 max-w-5xl">
      <div className="flex items-center mb-6">
        <Button variant="ghost" onClick={() => navigate('/portfolio-explorer')} className="mr-2">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <h1 className="text-2xl font-bold">{portfolioPage.title}</h1>
      </div>
      
      <Tabs defaultValue="projects" className="space-y-6">
        <TabsList className="grid grid-cols-2 w-[400px]">
          <TabsTrigger value="projects">Projects</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>
        
        <TabsContent value="projects" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex justify-between items-center">
                <span>Portfolio Projects</span>
                <Button 
                  onClick={() => setAddProjectDialogOpen(true)}
                  className="bg-[#9b87f5] hover:bg-[#8B5CF6]"
                  disabled={availableProjects.length === 0}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Project
                </Button>
              </CardTitle>
              <CardDescription>
                Arrange your projects in the order you want them to appear. Drag to reorder.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!portfolioPage.projects || portfolioPage.projects.length === 0 ? (
                <div className="text-center py-12 border border-dashed rounded-md">
                  <h3 className="font-medium text-lg mb-2">No projects added yet</h3>
                  <p className="text-gray-500 mb-4">
                    Add completed projects to your portfolio to showcase your work.
                  </p>
                  <Button 
                    onClick={() => setAddProjectDialogOpen(true)}
                    className="bg-[#9b87f5] hover:bg-[#8B5CF6]"
                    disabled={availableProjects.length === 0}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Project
                  </Button>
                  {availableProjects.length === 0 && (
                    <p className="text-sm text-amber-600 mt-4">
                      You need to have projects with "Completed" status to add them to your portfolio.
                    </p>
                  )}
                </div>
              ) : (
                <DragDropContext onDragEnd={handleDragEnd}>
                  <Droppable droppableId="portfolio-projects">
                    {(provided) => (
                      <div
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        className="space-y-3"
                      >
                        {portfolioPage.projects.map((projectItem, index) => (
                          <Draggable 
                            key={projectItem.id} 
                            draggableId={projectItem.id} 
                            index={index}
                          >
                            {(provided) => {
                              const project = projectItem.project;
                              if (!project) return null;
                              
                              return (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  className="border rounded-md p-4"
                                >
                                  <div className="flex items-start justify-between">
                                    <div className="flex flex-1">
                                      <div 
                                        {...provided.dragHandleProps}
                                        className="mr-3 self-center cursor-grab"
                                      >
                                        <MoveVertical className="h-5 w-5 text-gray-400" />
                                      </div>
                                      <div className="flex-1">
                                        <h3 className="font-medium text-lg">{project.title}</h3>
                                        
                                        {editingProject?.id === projectItem.id ? (
                                          <div className="mt-2 space-y-2">
                                            <Textarea
                                              value={customDescription}
                                              onChange={(e) => setCustomDescription(e.target.value)}
                                              placeholder="Add a custom description for this project..."
                                              rows={4}
                                              className="mt-1"
                                            />
                                            <div className="flex space-x-2">
                                              <Button 
                                                size="sm" 
                                                onClick={saveCustomDescription}
                                                className="bg-[#9b87f5] hover:bg-[#8B5CF6]"
                                              >
                                                <Check className="h-4 w-4 mr-1" />
                                                Save
                                              </Button>
                                              <Button 
                                                size="sm" 
                                                variant="outline" 
                                                onClick={() => setEditingProject(null)}
                                              >
                                                Cancel
                                              </Button>
                                            </div>
                                          </div>
                                        ) : (
                                          <p className="text-gray-600 mt-1">
                                            {projectItem.custom_description || project.description || 'No description'}
                                          </p>
                                        )}
                                        
                                        {project.required_skills && project.required_skills.length > 0 && (
                                          <div className="mt-2 flex flex-wrap gap-1">
                                            {project.required_skills.map((skill, i) => (
                                              <span 
                                                key={i} 
                                                className="bg-gray-100 text-gray-800 text-xs font-medium px-2 py-0.5 rounded"
                                              >
                                                {skill}
                                              </span>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    
                                    <div className="flex space-x-1 ml-2">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleEditProject(projectItem)}
                                        disabled={editingProject?.id === projectItem.id}
                                      >
                                        <Edit className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleRemoveProject(project.id)}
                                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                      >
                                        <X className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              );
                            }}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="preview" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Preview</CardTitle>
              <CardDescription>
                This is how your portfolio projects will appear to visitors
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {portfolioPage.projects && portfolioPage.projects.length > 0 ? (
                  portfolioPage.projects.map((projectItem) => {
                    const project = projectItem.project;
                    if (!project) return null;
                    
                    return (
                      <div key={projectItem.id} className="border rounded-lg p-4">
                        <h3 className="font-semibold text-lg mb-2">{project.title}</h3>
                        <p className="text-gray-600 text-sm mb-3">
                          {projectItem.custom_description || project.description || 'No description'}
                        </p>
                        {project.required_skills && project.required_skills.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {project.required_skills.map((skill, i) => (
                              <span 
                                key={i} 
                                className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5 rounded"
                              >
                                {skill}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="col-span-full text-center py-8 text-gray-500">
                    No projects to preview
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Add Project Dialog */}
      <Dialog open={addProjectDialogOpen} onOpenChange={setAddProjectDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Add Project to Portfolio</DialogTitle>
            <DialogDescription>
              Select completed projects to add to your portfolio
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-4">
              {availableProjects.length === 0 ? (
                <div className="text-center py-8">
                  <FileCheck className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No completed projects</h3>
                  <p className="text-gray-500">
                    Complete some projects in your project tracker to add them here.
                  </p>
                </div>
              ) : (
                availableProjects.map((project) => (
                  <Card key={project.id} className="cursor-pointer hover:bg-gray-50">
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <CardTitle className="text-lg">{project.title}</CardTitle>
                          <CardDescription className="mt-1">
                            {project.description || 'No description'}
                          </CardDescription>
                        </div>
                        <Button
                          onClick={() => handleAddProject(project)}
                          className="bg-[#9b87f5] hover:bg-[#8B5CF6] ml-4"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add
                        </Button>
                      </div>
                    </CardHeader>
                    {project.required_skills && project.required_skills.length > 0 && (
                      <CardContent className="pt-0">
                        <div className="flex flex-wrap gap-1">
                          {project.required_skills.map((skill, i) => (
                            <span 
                              key={i} 
                              className="bg-gray-100 text-gray-800 text-xs font-medium px-2 py-0.5 rounded"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      </CardContent>
                    )}
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
