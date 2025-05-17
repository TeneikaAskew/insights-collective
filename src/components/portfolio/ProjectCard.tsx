
import React, { useState } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PortfolioProject } from '@/types/portfolio';
import { Badge } from '@/components/ui/badge';
import { Trash2, Edit, ChevronDown, ChevronUp } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface ProjectCardProps {
  project: PortfolioProject;
  onDelete: (id: string) => void;
  onUpdate: (project: PortfolioProject) => void;
}

export function ProjectCard({ project, onDelete, onUpdate }: ProjectCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedProject, setEditedProject] = useState(project);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: project.id,
  });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  
  const handleEditSubmit = () => {
    onUpdate(editedProject);
    setIsEditing(false);
  };
  
  const handleDeleteConfirm = () => {
    onDelete(project.id);
    setShowDeleteConfirm(false);
  };

  // Determine card status colors
  let statusColor = '';
  switch (project.status) {
    case 'Idea':
      statusColor = 'bg-gray-100 text-gray-800';
      break;
    case 'Planned':
      statusColor = 'bg-blue-100 text-blue-800';
      break;
    case 'In Progress':
      statusColor = 'bg-amber-100 text-amber-800';
      break;
    case 'Completed':
      statusColor = 'bg-green-100 text-green-800';
      break;
  }

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        className={`touch-none ${isDragging ? 'z-10' : ''}`}
      >
        <Card className="shadow-sm hover:shadow transition-shadow cursor-grab">
          <CardHeader className="p-3 pb-0">
            <CardTitle className="text-base flex justify-between items-start">
              <span className="truncate">{project.title}</span>
              <Badge className={`ml-2 ${statusColor}`}>{project.status}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 text-sm">
            <p className="text-gray-500 text-xs mb-2 line-clamp-2">
              {project.description || 'No description provided'}
            </p>
            
            {(project.required_skills?.length > 0 || project.effort_level || project.impact) && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full h-6 p-0 text-xs text-gray-500 flex items-center justify-center"
                onClick={() => setIsExpanded(!isExpanded)}
              >
                {isExpanded ? (
                  <>
                    <ChevronUp className="h-3 w-3 mr-1" /> Show less
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3 w-3 mr-1" /> Show details
                  </>
                )}
              </Button>
            )}

            {isExpanded && (
              <div className="pt-2 space-y-2 text-xs">
                {project.required_skills?.length > 0 && (
                  <div>
                    <p className="font-medium mb-1">Required Skills</p>
                    <div className="flex flex-wrap gap-1">
                      {project.required_skills.map((skill, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                
                {project.effort_level && (
                  <div>
                    <p className="font-medium mb-1">Effort Level</p>
                    <p className="text-gray-600">{project.effort_level}</p>
                  </div>
                )}
                
                {project.impact && (
                  <div>
                    <p className="font-medium mb-1">Impact</p>
                    <p className="text-gray-600">{project.impact}</p>
                  </div>
                )}
                
                {project.roadmap?.milestones?.length > 0 && (
                  <div>
                    <p className="font-medium mb-1">Milestones</p>
                    <ul className="list-disc list-inside">
                      {project.roadmap.milestones.map((milestone, i) => (
                        <li key={i} className="text-gray-600">{milestone}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </CardContent>
          <CardFooter className="p-3 pt-0 flex justify-between">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2"
              onClick={() => setIsEditing(true)}
            >
              <Edit className="h-3.5 w-3.5 mr-1" /> Edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={() => setShowDeleteConfirm(true)}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* Edit Project Dialog */}
      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
            <DialogDescription>
              Update the details of your portfolio project.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Project Title</Label>
              <Input
                id="title"
                value={editedProject.title}
                onChange={(e) => setEditedProject({ ...editedProject, title: e.target.value })}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={editedProject.description || ''}
                onChange={(e) => setEditedProject({ ...editedProject, description: e.target.value })}
                rows={3}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="effort">Effort Level</Label>
              <Input
                id="effort"
                value={editedProject.effort_level || ''}
                onChange={(e) => setEditedProject({ ...editedProject, effort_level: e.target.value })}
                placeholder="e.g., Low, Medium, High"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="impact">Impact Statement</Label>
              <Textarea
                id="impact"
                value={editedProject.impact || ''}
                onChange={(e) => setEditedProject({ ...editedProject, impact: e.target.value })}
                rows={2}
                placeholder="Why is this project valuable to showcase?"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditSubmit}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the project "{project.title}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>
              Delete Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
