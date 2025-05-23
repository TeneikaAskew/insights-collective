
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePortfolioPages } from '@/hooks/usePortfolioPages';
import { usePortfolio } from '@/hooks/usePortfolio';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PortfolioPageActions } from './PortfolioPageActions';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { PortfolioProject, PortfolioPageProject } from '@/types/portfolio';
import { ArrowLeft, Plus, Edit, Trash, MoveVertical, Palette, Layout, Eye } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/hooks/use-toast';

export function EnhancedPortfolioEditor() {
  const { pageId } = useParams<{ pageId: string }>();
  const navigate = useNavigate();
  const { usePortfolioPageWithProjects, addProjectToPage, removeProjectFromPage, updatePortfolioPageProject, updatePortfolioPage } = usePortfolioPages();
  const { projects, projectsLoading } = usePortfolio();
  
  const { data: portfolioPage, isLoading: pageLoading } = usePortfolioPageWithProjects(pageId);
  const [addProjectDialogOpen, setAddProjectDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<PortfolioPageProject | null>(null);
  const [customDescription, setCustomDescription] = useState('');
  const [pageSettings, setPageSettings] = useState({
    title: '',
    description: '',
    theme: 'default',
    is_public: false,
    custom_url: ''
  });

  React.useEffect(() => {
    if (portfolioPage) {
      setPageSettings({
        title: portfolioPage.title,
        description: portfolioPage.description || '',
        theme: portfolioPage.theme,
        is_public: portfolioPage.is_public,
        custom_url: portfolioPage.custom_url || ''
      });
    }
  }, [portfolioPage]);

  const handleUpdatePageSettings = async () => {
    if (!pageId) return;
    
    try {
      await updatePortfolioPage.mutateAsync({
        id: pageId,
        ...pageSettings
      });
      toast({
        title: 'Settings updated',
        description: 'Portfolio page settings have been saved.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update portfolio settings.',
        variant: 'destructive',
      });
    }
  };

  const handleAddProject = async (project: PortfolioProject) => {
    if (!pageId) return;
    await addProjectToPage.mutateAsync({
      pageId,
      projectId: project.id,
      displayOrder: portfolioPage?.projects?.length || 0
    });
    setAddProjectDialogOpen(false);
  };
  
  const handleRemoveProject = async (pageProjectId: string) => {
    if (!pageId) return;
    await removeProjectFromPage.mutateAsync({
      pageProjectId,
      pageId
    });
  };
  
  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;
    
    if (!destination || !portfolioPage?.projects) return;
    
    if (destination.droppableId === source.droppableId && destination.index === source.index) {
      return;
    }
    
    const newProjects = [...portfolioPage.projects];
    const draggedProject = newProjects.find(p => p.id === draggableId);
    if (!draggedProject) return;
    
    newProjects.splice(source.index, 1);
    newProjects.splice(destination.index, 0, draggedProject);
    
    for (let i = 0; i < newProjects.length; i++) {
      if (newProjects[i].display_order !== i) {
        await updatePortfolioPageProject.mutateAsync({
          id: newProjects[i].id,
          pageId: pageId!,
          updates: { display_order: i }
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
      id: editingProject.id,
      pageId,
      updates: { custom_description: customDescription }
    });
    
    setEditingProject(null);
  };

  const getAvailableProjects = () => {
    if (!projects || !portfolioPage?.projects) return [];
    
    const existingProjectIds = new Set(portfolioPage.projects.map(p => p.project_id));
    return projects.filter(p => p.status === 'Completed' && !existingProjectIds.has(p.id));
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
    <div className="container mx-auto p-4 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Button variant="ghost" onClick={() => navigate('/portfolio-explorer')} className="mr-2">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <h1 className="text-2xl font-bold">{portfolioPage.title}</h1>
        </div>
        
        <PortfolioPageActions portfolioPage={portfolioPage} />
      </div>
      
      <Tabs defaultValue="design" className="space-y-6">
        <TabsList className="grid grid-cols-4 w-[500px]">
          <TabsTrigger value="design" className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            Design
          </TabsTrigger>
          <TabsTrigger value="layout" className="flex items-center gap-2">
            <Layout className="h-4 w-4" />
            Layout
          </TabsTrigger>
          <TabsTrigger value="projects" className="flex items-center gap-2">
            <Edit className="h-4 w-4" />
            Projects
          </TabsTrigger>
          <TabsTrigger value="preview" className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Preview
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="design" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Portfolio Settings</CardTitle>
              <CardDescription>
                Configure your portfolio's basic information and visibility settings.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="title">Portfolio Title</Label>
                  <Input
                    id="title"
                    value={pageSettings.title}
                    onChange={(e) => setPageSettings(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="My Portfolio"
                  />
                </div>
                
                <div>
                  <Label htmlFor="custom_url">Custom URL</Label>
                  <Input
                    id="custom_url"
                    value={pageSettings.custom_url}
                    onChange={(e) => setPageSettings(prev => ({ ...prev, custom_url: e.target.value }))}
                    placeholder="my-portfolio"
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={pageSettings.description}
                  onChange={(e) => setPageSettings(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="A brief description of your portfolio..."
                  rows={3}
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="theme">Theme</Label>
                  <Select
                    value={pageSettings.theme}
                    onValueChange={(value) => setPageSettings(prev => ({ ...prev, theme: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Default</SelectItem>
                      <SelectItem value="minimal">Minimal</SelectItem>
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="creative">Creative</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_public"
                    checked={pageSettings.is_public}
                    onCheckedChange={(checked) => setPageSettings(prev => ({ ...prev, is_public: checked }))}
                  />
                  <Label htmlFor="is_public">Make portfolio public</Label>
                </div>
              </div>
              
              <Button onClick={handleUpdatePageSettings} className="bg-[#9b87f5] hover:bg-[#8B5CF6]">
                Save Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="layout" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Layout Customization</CardTitle>
              <CardDescription>
                Choose how your portfolio content is displayed and organized.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center cursor-pointer hover:border-[#9b87f5] transition-colors">
                  <div className="h-20 bg-gray-100 rounded mb-2"></div>
                  <p className="text-sm">Grid Layout</p>
                </div>
                
                <div className="border-2 border-[#9b87f5] rounded-lg p-4 text-center cursor-pointer">
                  <div className="h-20 bg-[#9b87f5]/10 rounded mb-2"></div>
                  <p className="text-sm font-medium">List Layout</p>
                </div>
                
                <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center cursor-pointer hover:border-[#9b87f5] transition-colors">
                  <div className="h-20 bg-gray-100 rounded mb-2"></div>
                  <p className="text-sm">Card Layout</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
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
                                  className="border rounded-md p-4 bg-white"
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
                                            />
                                            <div className="flex space-x-2">
                                              <Button 
                                                size="sm" 
                                                onClick={saveCustomDescription}
                                                className="bg-[#9b87f5] hover:bg-[#8B5CF6]"
                                              >
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
                                                className="bg-[#9b87f5]/10 text-[#9b87f5] text-xs font-medium px-2 py-0.5 rounded"
                                              >
                                                {skill}
                                              </span>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    
                                    <div className="flex space-x-2">
                                      {editingProject?.id !== projectItem.id && (
                                        <Button 
                                          size="sm" 
                                          variant="ghost" 
                                          onClick={() => handleEditProject(projectItem)}
                                        >
                                          <Edit className="h-4 w-4" />
                                        </Button>
                                      )}
                                      <Button 
                                        size="sm" 
                                        variant="ghost" 
                                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                        onClick={() => handleRemoveProject(projectItem.id)}
                                      >
                                        <Trash className="h-4 w-4" />
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
        
        <TabsContent value="preview">
          <Card>
            <CardHeader>
              <CardTitle>Portfolio Preview</CardTitle>
              <CardDescription>
                This is how your portfolio will look to visitors.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg p-6 bg-white min-h-[600px]">
                <div className="max-w-4xl mx-auto">
                  <header className="text-center mb-12">
                    <h1 className="text-4xl font-bold mb-4 text-gray-900">{portfolioPage.title}</h1>
                    {portfolioPage.description && (
                      <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
                        {portfolioPage.description}
                      </p>
                    )}
                  </header>
                  
                  {!portfolioPage.projects || portfolioPage.projects.length === 0 ? (
                    <div className="text-center py-16">
                      <p className="text-xl text-gray-500">
                        No projects added to this portfolio yet.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-16">
                      {portfolioPage.projects.map((projectItem) => {
                        const project = projectItem.project;
                        if (!project) return null;
                        
                        return (
                          <div key={projectItem.id} className="border-b pb-16 last:border-0">
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                              <div className="lg:col-span-2">
                                <h2 className="text-3xl font-bold mb-4 text-gray-900">{project.title}</h2>
                                <p className="text-lg text-gray-700 mb-6 leading-relaxed">
                                  {projectItem.custom_description || project.description}
                                </p>
                                
                                {project.roadmap && project.roadmap.milestones && project.roadmap.milestones.length > 0 && (
                                  <div className="mt-6">
                                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Key Achievements</h3>
                                    <ul className="space-y-2">
                                      {project.roadmap.milestones.map((milestone, idx) => (
                                        <li key={idx} className="flex items-start">
                                          <div className="w-2 h-2 bg-[#9b87f5] rounded-full mt-2 mr-3 flex-shrink-0"></div>
                                          <span className="text-gray-700">{milestone}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                              
                              <div className="space-y-6">
                                {project.required_skills && project.required_skills.length > 0 && (
                                  <div>
                                    <h3 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wider">Technologies</h3>
                                    <div className="flex flex-wrap gap-2">
                                      {project.required_skills.map((skill, i) => (
                                        <span 
                                          key={i} 
                                          className="bg-[#9b87f5]/10 text-[#9b87f5] text-sm font-medium px-3 py-1 rounded-full"
                                        >
                                          {skill}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                
                                <div>
                                  <h3 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wider">Project Details</h3>
                                  <div className="space-y-3">
                                    {project.effort_level && (
                                      <div className="flex justify-between">
                                        <span className="text-gray-600">Complexity:</span>
                                        <span className="font-medium text-gray-900">{project.effort_level}</span>
                                      </div>
                                    )}
                                    {project.impact && (
                                      <div className="flex justify-between">
                                        <span className="text-gray-600">Impact:</span>
                                        <span className="font-medium text-gray-900">{project.impact}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Add Project Dialog */}
      <Dialog open={addProjectDialogOpen} onOpenChange={setAddProjectDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Project to Portfolio</DialogTitle>
            <DialogDescription>
              Select a completed project to add to your portfolio page.
            </DialogDescription>
          </DialogHeader>
          
          {projectsLoading ? (
            <div className="py-8 flex justify-center">
              <Spinner size="lg" />
            </div>
          ) : availableProjects.length === 0 ? (
            <div className="text-center py-8">
              <h3 className="text-lg font-medium mb-1">No available projects</h3>
              <p className="text-gray-500">
                All your completed projects are already added to this portfolio.
              </p>
            </div>
          ) : (
            <ScrollArea className="max-h-[400px] pr-4">
              <div className="space-y-3">
                {availableProjects.map((project) => (
                  <Card key={project.id} className="cursor-pointer hover:bg-gray-50 transition-colors">
                    <CardContent className="p-4" onClick={() => handleAddProject(project)}>
                      <h3 className="font-medium">{project.title}</h3>
                      <p className="text-gray-500 text-sm line-clamp-2 mt-1">
                        {project.description || 'No description'}
                      </p>
                      {project.required_skills && project.required_skills.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {project.required_skills.slice(0, 3).map((skill, i) => (
                            <span 
                              key={i} 
                              className="bg-[#9b87f5]/10 text-[#9b87f5] text-xs px-2 py-0.5 rounded"
                            >
                              {skill}
                            </span>
                          ))}
                          {project.required_skills.length > 3 && (
                            <span className="text-xs text-gray-500">
                              +{project.required_skills.length - 3} more
                            </span>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddProjectDialogOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
