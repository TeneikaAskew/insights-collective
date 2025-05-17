
import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { MoreHorizontal, Trash, Edit, GripVertical } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PortfolioProject } from '@/types/portfolio';

interface ProjectCardProps {
  project: PortfolioProject;
  onUpdate: (project: PortfolioProject) => void;
  onDelete: (projectId: string) => void;
}

export function ProjectCard({ project, onUpdate, onDelete }: ProjectCardProps) {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editedProject, setEditedProject] = useState<PortfolioProject>(project);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: project.id,
    data: {
      type: 'project',
      project,
    },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 1,
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdate(editedProject);
    setIsEditDialogOpen(false);
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setEditedProject((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleConfirmDelete = () => {
    onDelete(project.id);
    setIsDeleteDialogOpen(false);
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className="mb-3 border shadow-sm"
    >
      <div className="p-3">
        <div className="flex items-start justify-between">
          <div className="flex-grow">
            <h3 className="font-medium text-sm">{project.title}</h3>
            <p className="text-xs text-gray-500 mt-1 line-clamp-2">
              {project.description || "No description"}
            </p>
          </div>

          <div className="flex">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              {...attributes}
              {...listeners}
            >
              <GripVertical className="h-4 w-4 cursor-grab" />
              <span className="sr-only">Drag</span>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setIsEditDialogOpen(true)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  className="text-red-600"
                  onClick={() => setIsDeleteDialogOpen(true)}
                >
                  <Trash className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {project.required_skills && project.required_skills.length > 0 && (
          <div className="mt-2">
            <div className="flex flex-wrap gap-1">
              {project.required_skills.slice(0, 3).map((skill, index) => (
                <span
                  key={index}
                  className="px-1.5 py-0.5 bg-[#9b87f5]/10 text-[#9b87f5] text-xs rounded-md"
                >
                  {skill}
                </span>
              ))}
              {project.required_skills.length > 3 && (
                <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-md">
                  +{project.required_skills.length - 3} more
                </span>
              )}
            </div>
          </div>
        )}

        {project.effort_level && (
          <div className="mt-2 flex items-center gap-1">
            <span className="text-xs text-gray-500">Effort:</span>
            <span className="text-xs font-medium">
              {project.effort_level}
            </span>
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
            <DialogDescription>
              Update your project details.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditSubmit}>
            <div className="space-y-4 py-2">
              <div>
                <Label htmlFor="title">Project Title</Label>
                <Input
                  id="title"
                  name="title"
                  value={editedProject.title}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  name="description"
                  value={editedProject.description || ""}
                  onChange={handleInputChange}
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="effort_level">Effort Level</Label>
                <select
                  id="effort_level"
                  name="effort_level"
                  value={editedProject.effort_level || "Medium"}
                  onChange={(e) => handleInputChange(e as any)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
              </div>
            </div>

            <DialogFooter className="mt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsEditDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Save Changes</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this project? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setIsDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button 
              type="button" 
              variant="destructive" 
              onClick={handleConfirmDelete}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
