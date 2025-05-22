
import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PortfolioProject } from '@/types/portfolio';
import { Edit, GripVertical, Trash } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { AddToPortfolio } from './AddToPortfolio';

interface ProjectCardProps {
  project: PortfolioProject;
  onDelete: (projectId: string) => void;
  onUpdate: (project: PortfolioProject) => void;
}

export function ProjectCard({ project, onDelete, onUpdate }: ProjectCardProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
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

  const handleUpdateProject = () => {
    onUpdate(formData);
    setIsDialogOpen(false);
  };

  const handleDeleteProject = () => {
    onDelete(project.id);
    setIsDeleteDialogOpen(false);
  };

  const truncate = (str: string, length: number) => {
    if (!str) return '';
    return str.length > length ? str.substring(0, length) + '...' : str;
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className="bg-white shadow-sm"
    >
      <CardContent className="p-3">
        <div className="flex gap-2">
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab"
          >
            <GripVertical className="h-5 w-5 text-gray-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium truncate">{project.title}</h3>
            {project.description && (
              <p className="text-sm text-gray-500 mt-1">
                {truncate(project.description, 100)}
              </p>
            )}
            {project.required_skills && project.required_skills.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {project.required_skills.slice(0, 3).map((skill, index) => (
                  <span
                    key={index}
                    className="bg-gray-100 text-xs px-1.5 py-0.5 rounded text-gray-700"
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
          </div>
        </div>
      </CardContent>
      <CardFooter className="p-3 pt-0 flex justify-between border-t mt-3">
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsDialogOpen(true)}
          >
            <Edit className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-red-500 hover:text-red-700 hover:bg-red-50"
            onClick={() => setIsDeleteDialogOpen(true)}
          >
            <Trash className="h-3.5 w-3.5" />
          </Button>
        </div>
        
        {project.status === 'Completed' && (
          <AddToPortfolio project={project} />
        )}
      </CardFooter>

      {/* Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
            <DialogDescription>
              Update your project details
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                name="title"
                value={formData.title}
                onChange={handleFormChange}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                value={formData.description || ''}
                onChange={handleFormChange}
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="skills">Skills (comma separated)</Label>
              <Input
                id="skills"
                value={formData.required_skills?.join(', ') || ''}
                onChange={handleSkillsChange}
                placeholder="React, TypeScript, Firebase"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="effort_level">Effort Level</Label>
                <Input
                  id="effort_level"
                  name="effort_level"
                  value={formData.effort_level || ''}
                  onChange={handleFormChange}
                  placeholder="Medium"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="impact">Impact</Label>
                <Input
                  id="impact"
                  name="impact"
                  value={formData.impact || ''}
                  onChange={handleFormChange}
                  placeholder="High business value"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateProject}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this project? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteProject}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
