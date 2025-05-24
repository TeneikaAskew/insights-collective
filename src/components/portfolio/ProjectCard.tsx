import React, { useState, useEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PortfolioProject, ProjectStatus } from '@/types/portfolio';
import { Edit, GripVertical, Trash, Plus, Briefcase, ExternalLink, Github, Upload, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { usePortfolioPages } from '@/hooks/usePortfolioPages';

interface ProjectCardProps {
  project: PortfolioProject;
  onDelete: (projectId: string) => void;
  onUpdate: (project: PortfolioProject) => void;
  onStatusChange?: (projectId: string, newStatus: ProjectStatus) => void;
  isKanbanView?: boolean;
}

export function ProjectCard({ project, onDelete, onUpdate, onStatusChange, isKanbanView = true }: ProjectCardProps) {
  const { toast } = useToast();
  const { portfolioPages } = usePortfolioPages();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isAddToPortfolioOpen, setIsAddToPortfolioOpen] = useState(false);
  const [formData, setFormData] = useState({ ...project });
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);

  // Update formData when project prop changes
  useEffect(() => {
    setFormData({ ...project });
  }, [project]);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: project.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 999 : 'auto',
  };

  const handleFormChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData({ ...formData, [name]: value });
  };

  const handleSkillsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const skills = e.target.value
      .split(',')
      .map((skill) => skill.trim())
      .filter((skill) => skill !== '');
    setFormData({ ...formData, required_skills: skills });
  };

  const handleRoadmapChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const milestones = e.target.value
      .split('\n')
      .map((milestone) => milestone.trim())
      .filter((milestone) => milestone !== '');
    setFormData({ 
      ...formData, 
      roadmap: { milestones }
    });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach((file) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          if (event.target?.result) {
            setUploadedImages(prev => [...prev, event.target!.result as string]);
          }
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const removeImage = (index: number) => {
    setUploadedImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpdateProject = () => {
    console.log('Updating project with form data:', formData);
    onUpdate(formData);
    setIsDialogOpen(false);
    toast({
      title: "Project updated",
      description: "Your project has been updated successfully.",
    });
  };

  const handleDeleteProject = () => {
    onDelete(project.id);
    setIsDeleteDialogOpen(false);
    toast({
      title: "Project deleted",
      description: "Your project has been deleted successfully.",
    });
  };

  const handleStatusChange = (newStatus: ProjectStatus) => {
    if (onStatusChange) {
      onStatusChange(project.id, newStatus);
      toast({
        title: "Status updated",
        description: `Project status changed to ${newStatus}`,
      });
    }
  };

  const handleAddToPortfolio = () => {
    if (!portfolioPages || portfolioPages.length === 0) {
      toast({
        title: "No portfolio pages",
        description: "Create a portfolio page first to add projects to it.",
        variant: "destructive",
      });
      return;
    }
    
    setIsAddToPortfolioOpen(true);
  };

  const truncate = (str: string, length: number) => {
    if (!str) return '';
    return str.length > length ? str.substring(0, length) + '...' : str;
  };

  const getStatusColor = (status: ProjectStatus) => {
    switch (status) {
      case 'Idea': return 'bg-gray-100 text-gray-800';
      case 'Planned': return 'bg-blue-100 text-blue-800';
      case 'In Progress': return 'bg-amber-100 text-amber-800';
      case 'Completed': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Simple Kanban view - only title and description
  if (isKanbanView) {
    return (
      <Card
        ref={setNodeRef}
        style={style}
        className="bg-white shadow-sm hover:shadow-md transition-shadow"
      >
        <CardContent className="p-4">
          <div className="flex gap-3">
            <div
              {...attributes}
              {...listeners}
              className="cursor-grab hover:cursor-grabbing"
            >
              <GripVertical className="h-5 w-5 text-gray-400" />
            </div>
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex justify-between items-start gap-2">
                <h3 className="font-semibold text-lg leading-tight flex-1">{project.title}</h3>
                {project.status === 'Completed' && (
                  <div className="flex gap-1 flex-shrink-0">
                    {project.live_url && (
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="h-7 w-7 p-0 hover:bg-blue-50"
                        onClick={() => window.open(project.live_url, '_blank')}
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    )}
                    {project.github_url && (
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="h-7 w-7 p-0 hover:bg-gray-50"
                        onClick={() => window.open(project.github_url, '_blank')}
                      >
                        <Github className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
              {project.description && (
                <p className="text-sm text-gray-600">
                  {truncate(project.description, 100)}
                </p>
              )}
            </div>
          </div>
        </CardContent>
        
        <CardFooter className="p-4 pt-0 border-t bg-gray-50/50">
          <div className="flex flex-col w-full gap-2">
            <div className="flex justify-between items-center w-full">
              <div className="flex gap-1 flex-shrink-0">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsDialogOpen(true)}
                  className="hover:bg-blue-50 hover:text-blue-600"
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                  onClick={() => setIsDeleteDialogOpen(true)}
                >
                  <Trash className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            {project.status === 'Completed' && (
              <Button 
                size="sm" 
                variant="outline" 
                className="text-xs px-2 py-1 h-8 w-full hover:bg-purple-50 hover:text-purple-600 hover:border-purple-200"
                onClick={handleAddToPortfolio}
              >
                <Plus className="h-3 w-3 mr-1" />
                <span>Portfolio</span>
              </Button>
            )}
          </div>
        </CardFooter>

        {/* Enhanced Edit Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Project</DialogTitle>
              <DialogDescription>
                Update your project details and make it portfolio-ready
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">Project Title</Label>
                <Input
                  id="title"
                  name="title"
                  value={formData.title}
                  onChange={handleFormChange}
                  placeholder="Enter a compelling project title"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description">Project Description</Label>
                <Textarea
                  id="description"
                  name="description"
                  value={formData.description || ''}
                  onChange={handleFormChange}
                  rows={4}
                  placeholder="Describe what this project does and its key features..."
                />
              </div>

              {/* GitHub and External Links */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="github_url">GitHub URL</Label>
                  <Input
                    id="github_url"
                    name="github_url"
                    value={formData.github_url || ''}
                    onChange={handleFormChange}
                    placeholder="https://github.com/username/repo"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="live_url">Live Demo URL</Label>
                  <Input
                    id="live_url"
                    name="live_url"
                    value={formData.live_url || ''}
                    onChange={handleFormChange}
                    placeholder="https://myproject.com"
                  />
                </div>
              </div>

              {/* Image Upload for Completed Projects */}
              {formData.status === 'Completed' && (
                <div className="space-y-2">
                  <Label htmlFor="project_images">Project Screenshots</Label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                    <div className="text-center">
                      <Upload className="mx-auto h-12 w-12 text-gray-400" />
                      <div className="mt-2">
                        <label htmlFor="image-upload" className="cursor-pointer">
                          <span className="mt-2 block text-sm font-medium text-gray-900">
                            Upload project screenshots
                          </span>
                          <span className="mt-1 block text-sm text-gray-500">
                            PNG, JPG, GIF up to 10MB
                          </span>
                        </label>
                        <input
                          id="image-upload"
                          type="file"
                          className="hidden"
                          multiple
                          accept="image/*"
                          onChange={handleImageUpload}
                        />
                      </div>
                    </div>
                  </div>
                  
                  {uploadedImages.length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm font-medium text-gray-700 mb-2">Uploaded Images:</p>
                      <div className="grid grid-cols-2 gap-2">
                        {uploadedImages.map((image, index) => (
                          <div key={index} className="relative">
                            <img
                              src={image}
                              alt={`Project screenshot ${index + 1}`}
                              className="w-full h-32 object-cover rounded-lg"
                            />
                            <Button
                              size="sm"
                              variant="destructive"
                              className="absolute top-1 right-1 h-6 w-6 p-0"
                              onClick={() => removeImage(index)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="skills">Technical Skills (comma separated)</Label>
                <Input
                  id="skills"
                  value={formData.required_skills?.join(', ') || ''}
                  onChange={handleSkillsChange}
                  placeholder="React, TypeScript, Node.js, PostgreSQL, AWS"
                />
                <p className="text-xs text-gray-500">
                  Add the main technologies and tools used in this project
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="effort_level">Effort Level</Label>
                  <Select value={formData.effort_level || ''} onValueChange={(value) => handleSelectChange('effort_level', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select effort level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Low (< 10 hours)">Low (&lt; 10 hours)</SelectItem>
                      <SelectItem value="Medium (10-30 hours)">Medium (10-30 hours)</SelectItem>
                      <SelectItem value="High (30+ hours)">High (30+ hours)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select value={formData.status || ''} onValueChange={(value) => handleSelectChange('status', value as ProjectStatus)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Idea">Idea</SelectItem>
                      <SelectItem value="Planned">Planned</SelectItem>
                      <SelectItem value="In Progress">In Progress</SelectItem>
                      <SelectItem value="Completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="impact">Business Impact</Label>
                <Input
                  id="impact"
                  name="impact"
                  value={formData.impact || ''}
                  onChange={handleFormChange}
                  placeholder="High ROI, User engagement, etc."
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="roadmap">Key Achievements (one per line)</Label>
                <Textarea
                  id="roadmap"
                  value={formData.roadmap?.milestones?.join('\n') || ''}
                  onChange={handleRoadmapChange}
                  rows={5}
                  placeholder="Implemented user authentication system&#10;Designed responsive UI components&#10;Optimized database queries for 50% faster performance&#10;Deployed to AWS with CI/CD pipeline"
                />
                <p className="text-xs text-gray-500">
                  List the main accomplishments and milestones of this project
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpdateProject} className="bg-blue-600 hover:bg-blue-700">
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Project</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete "{project.title}"? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDeleteProject}>
                Delete Project
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add to Portfolio Dialog */}
        <Dialog open={isAddToPortfolioOpen} onOpenChange={setIsAddToPortfolioOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add to Portfolio</DialogTitle>
              <DialogDescription>
                Choose which portfolio page to add this project to.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              {portfolioPages?.map((page) => (
                <Button
                  key={page.id}
                  variant="outline"
                  className="w-full justify-start mb-2"
                  onClick={() => {
                    toast({
                      title: "Project added",
                      description: `Added "${project.title}" to "${page.title}" portfolio.`,
                    });
                    setIsAddToPortfolioOpen(false);
                  }}
                >
                  <Briefcase className="h-4 w-4 mr-2" />
                  {page.title}
                </Button>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddToPortfolioOpen(false)}>
                Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Card>
    );
  }

  // Full detailed view for portfolio editor or other views
  return (
    <Card
      ref={setNodeRef}
      style={style}
      className="bg-white shadow-sm hover:shadow-md transition-shadow"
    >
      <CardContent className="p-4">
        <div className="flex gap-3">
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab hover:cursor-grabbing"
          >
            <GripVertical className="h-5 w-5 text-gray-400" />
          </div>
          <div className="flex-1 min-w-0 space-y-3">
            <div>
              <div className="flex justify-between items-start mb-1">
                <h3 className="font-semibold text-lg leading-tight">{project.title}</h3>
                <div className="flex items-center gap-2">
                  {project.status === 'Completed' && (
                    <div className="flex gap-1 flex-shrink-0">
                      {project.live_url && (
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-7 w-7 p-0 hover:bg-blue-50"
                          onClick={() => window.open(project.live_url, '_blank')}
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      )}
                      {project.github_url && (
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-7 w-7 p-0 hover:bg-gray-50"
                          onClick={() => window.open(project.github_url, '_blank')}
                        >
                          <Github className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  )}
                  {project.status && (
                    <Badge className={`text-xs ${getStatusColor(project.status)}`}>
                      {project.status}
                    </Badge>
                  )}
                </div>
              </div>
              {project.description && (
                <p className="text-sm text-gray-600 mt-1">
                  {truncate(project.description, 120)}
                </p>
              )}
            </div>

            {/* Tech Stack */}
            {project.required_skills && project.required_skills.length > 0 && (
              <div>
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Tech Stack</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {project.required_skills.slice(0, 4).map((skill, index) => (
                    <Badge key={index} variant="secondary" className="text-xs px-2 py-0.5">
                      {skill}
                    </Badge>
                  ))}
                  {project.required_skills.length > 4 && (
                    <Badge variant="outline" className="text-xs px-2 py-0.5">
                      +{project.required_skills.length - 4} more
                    </Badge>
                  )}
                </div>
              </div>
            )}

            {/* Effort and Impact */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              {project.effort_level && (
                <div>
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide block">Effort</span>
                  <span className="text-gray-700">{project.effort_level}</span>
                </div>
              )}
              {project.impact && (
                <div>
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide block">Impact</span>
                  <span className="text-gray-700">{truncate(project.impact, 30)}</span>
                </div>
              )}
            </div>

            {/* Key Achievements */}
            {project.roadmap?.milestones && project.roadmap.milestones.length > 0 && (
              <div>
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Key Achievements</span>
                <ul className="mt-1 space-y-1">
                  {project.roadmap.milestones.slice(0, 2).map((milestone, index) => (
                    <li key={index} className="text-xs text-gray-600 flex items-start gap-1">
                      <span className="text-green-500 mt-0.5">•</span>
                      <span>{truncate(milestone, 50)}</span>
                    </li>
                  ))}
                  {project.roadmap.milestones.length > 2 && (
                    <li className="text-xs text-gray-500">
                      +{project.roadmap.milestones.length - 2} more achievements
                    </li>
                  )}
                </ul>
              </div>
            )}

            {/* Status Update Dropdown for non-kanban view */}
            {onStatusChange && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Status:</span>
                <Select value={project.status || ''} onValueChange={handleStatusChange}>
                  <SelectTrigger className="w-32 h-7 text-xs">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Idea">Idea</SelectItem>
                    <SelectItem value="Planned">Planned</SelectItem>
                    <SelectItem value="In Progress">In Progress</SelectItem>
                    <SelectItem value="Completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>
      </CardContent>
      
      <CardFooter className="p-4 pt-0 border-t bg-gray-50/50">
        <div className="flex justify-between items-center w-full gap-2">
          <div className="flex gap-1 flex-shrink-0">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsDialogOpen(true)}
              className="hover:bg-blue-50 hover:text-blue-600"
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-red-500 hover:text-red-700 hover:bg-red-50"
              onClick={() => setIsDeleteDialogOpen(true)}
            >
              <Trash className="h-4 w-4" />
            </Button>
          </div>
          
          {project.status === 'Completed' && (
            <Button 
              size="sm" 
              variant="outline" 
              className="text-xs px-3 py-1 h-8 flex-shrink-0 hover:bg-purple-50 hover:text-purple-600 hover:border-purple-200"
              onClick={handleAddToPortfolio}
            >
              <Briefcase className="h-3 w-3 mr-1.5" />
              <span>Add to Portfolio</span>
            </Button>
          )}
        </div>
      </CardFooter>

      {/* Enhanced Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
            <DialogDescription>
              Update your project details and make it portfolio-ready
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Project Title</Label>
              <Input
                id="title"
                name="title"
                value={formData.title}
                onChange={handleFormChange}
                placeholder="Enter a compelling project title"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Project Description</Label>
              <Textarea
                id="description"
                name="description"
                value={formData.description || ''}
                onChange={handleFormChange}
                rows={4}
                placeholder="Describe what this project does and its key features..."
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="skills">Technical Skills (comma separated)</Label>
              <Input
                id="skills"
                value={formData.required_skills?.join(', ') || ''}
                onChange={handleSkillsChange}
                placeholder="React, TypeScript, Node.js, PostgreSQL, AWS"
              />
              <p className="text-xs text-gray-500">
                Add the main technologies and tools used in this project
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="effort_level">Effort Level</Label>
                <Select value={formData.effort_level || ''} onValueChange={(value) => handleSelectChange('effort_level', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select effort level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Low (< 10 hours)">Low (&lt; 10 hours)</SelectItem>
                    <SelectItem value="Medium (10-30 hours)">Medium (10-30 hours)</SelectItem>
                    <SelectItem value="High (30+ hours)">High (30+ hours)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={formData.status || ''} onValueChange={(value) => handleSelectChange('status', value as ProjectStatus)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Idea">Idea</SelectItem>
                    <SelectItem value="Planned">Planned</SelectItem>
                    <SelectItem value="In Progress">In Progress</SelectItem>
                    <SelectItem value="Completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="impact">Business Impact</Label>
              <Input
                id="impact"
                name="impact"
                value={formData.impact || ''}
                onChange={handleFormChange}
                placeholder="High ROI, User engagement, etc."
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="roadmap">Key Achievements (one per line)</Label>
              <Textarea
                id="roadmap"
                value={formData.roadmap?.milestones?.join('\n') || ''}
                onChange={handleRoadmapChange}
                rows={5}
                placeholder="Implemented user authentication system&#10;Designed responsive UI components&#10;Optimized database queries for 50% faster performance&#10;Deployed to AWS with CI/CD pipeline"
              />
              <p className="text-xs text-gray-500">
                List the main accomplishments and milestones of this project
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateProject} className="bg-blue-600 hover:bg-blue-700">
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{project.title}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteProject}>
              Delete Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add to Portfolio Dialog */}
      <Dialog open={isAddToPortfolioOpen} onOpenChange={setIsAddToPortfolioOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add to Portfolio</DialogTitle>
            <DialogDescription>
              Choose which portfolio page to add this project to.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {portfolioPages?.map((page) => (
              <Button
                key={page.id}
                variant="outline"
                className="w-full justify-start mb-2"
                onClick={() => {
                  toast({
                    title: "Project added",
                    description: `Added "${project.title}" to "${page.title}" portfolio.`,
                  });
                  setIsAddToPortfolioOpen(false);
                }}
              >
                <Briefcase className="h-4 w-4 mr-2" />
                {page.title}
              </Button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddToPortfolioOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
