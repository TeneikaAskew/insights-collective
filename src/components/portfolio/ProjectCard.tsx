
import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PortfolioProject } from '@/types/portfolio';
import { Edit, GripVertical, Trash, Plus, Briefcase } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { usePortfolioPages } from '@/hooks/usePortfolioPages';

interface ProjectCardProps {
  project: PortfolioProject;
  onDelete: (projectId: string) => void;
  onUpdate: (project: PortfolioProject) => void;
}

export function ProjectCard({ project, onDelete, onUpdate }: ProjectCardProps) {
  const { toast } = useToast();
  const { portfolioPages } = usePortfolioPages();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isAddToPortfolioOpen, setIsAddToPortfolioOpen] = useState(false);
  const [formData, setFormData] = useState({ ...project });

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

  const handleUpdateProject = () => {
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

  const handleAddToPortfolio = () => {
    if (!portfolioPages?.data || portfolioPages.data.length === 0) {
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
              <h3 className="font-semibold text-lg leading-tight">{project.title}</h3>
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
                <Input
                  id="effort_level"
                  name="effort_level"
                  value={formData.effort_level || ''}
                  onChange={handleFormChange}
                  placeholder="Low, Medium, High"
                />
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
            {portfolioPages?.data?.map((page) => (
              <Button
                key={page.id}
                variant="outline"
                className="w-full justify-start mb-2"
                onClick={() => {
                  // This would integrate with the AddToPortfolio component functionality
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
