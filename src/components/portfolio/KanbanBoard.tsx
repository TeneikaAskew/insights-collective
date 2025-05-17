
import React, { useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragOverlay,
  DragStartEvent,
  UniqueIdentifier,
  closestCorners,
  useDroppable
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Card } from '@/components/ui/card';
import { PortfolioProject, ProjectStatus } from '@/types/portfolio';
import { ProjectCard } from './ProjectCard';
import { useToast } from '@/hooks/use-toast';
import { createPortal } from 'react-dom';

const statusColumns: { id: ProjectStatus; title: string; color: string }[] = [
  { id: 'Idea', title: 'Ideas', color: 'bg-gray-100' },
  { id: 'Planned', title: 'Planned', color: 'bg-blue-50' },
  { id: 'In Progress', title: 'In Progress', color: 'bg-amber-50' },
  { id: 'Completed', title: 'Completed', color: 'bg-green-50' },
];

interface KanbanBoardProps {
  projects: PortfolioProject[];
  onStatusChange: (projectId: string, newStatus: ProjectStatus) => void;
  onUpdateProject: (project: PortfolioProject) => void;
  onDeleteProject: (projectId: string) => void;
}

function DroppableColumn({ 
  id, 
  children, 
  className 
}: { 
  id: string; 
  children: React.ReactNode; 
  className?: string;
}) {
  const { setNodeRef } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={className}>
      {children}
    </div>
  );
}

export function KanbanBoard({
  projects,
  onStatusChange,
  onUpdateProject,
  onDeleteProject,
}: KanbanBoardProps) {
  const { toast } = useToast();
  const [draggingProject, setDraggingProject] = useState<PortfolioProject | null>(null);
  const [localProjects, setLocalProjects] = useState<PortfolioProject[]>(projects || []);

  // Update local projects when props change
  React.useEffect(() => {
    setLocalProjects(projects || []);
  }, [projects]);

  // Configure sensors for drag and drop
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const draggedProject = localProjects.find(project => project.id === active.id);
    if (draggedProject) {
      setDraggingProject(draggedProject);
    }
  };

  // Handle drag end event
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over || active.id === over.id) {
      setDraggingProject(null);
      return;
    }
    
    // If no over target or same as active, do nothing
    if (!over) return;
    
    const projectId = active.id as string;
    // Check if we're dropping on a status column
    const isStatusColumn = statusColumns.some(col => col.id === over.id);
    
    if (isStatusColumn) {
      const newStatus = over.id as ProjectStatus;
      
      // Call parent handler to update status in database
      onStatusChange(projectId, newStatus);
      
      // Optimistically update local state
      setLocalProjects(prevProjects => 
        prevProjects.map(project => 
          project.id === projectId 
            ? { ...project, status: newStatus }
            : project
        )
      );
      
      // Show toast notification
      toast({
        title: "Status updated",
        description: `Project moved to ${newStatus}`,
      });
    }
    
    setDraggingProject(null);
  };

  const getProjectsByStatus = (status: ProjectStatus) => {
    return localProjects.filter((project) => project.status === status);
  };

  return (
    <div className="mt-6">
      <h2 className="text-2xl font-semibold mb-4">Portfolio Tracker</h2>
      <p className="text-gray-600 mb-6">
        Track your portfolio projects from idea to completion. Drag projects between columns to update their status.
      </p>

      <DndContext
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        sensors={sensors}
        collisionDetection={closestCorners}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {statusColumns.map((column) => {
            const columnProjects = getProjectsByStatus(column.id);
            
            return (
              <DroppableColumn
                key={column.id}
                id={column.id}
                className={`rounded-lg p-3 ${column.color} border min-h-[300px]`}
              >
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-semibold text-gray-700">{column.title}</h3>
                  <span className="bg-white text-gray-700 rounded-full px-2 py-0.5 text-xs font-medium">
                    {columnProjects.length}
                  </span>
                </div>
                
                <div className="space-y-3 min-h-[250px]">
                  <SortableContext
                    items={columnProjects.map(p => p.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {columnProjects.map((project) => (
                      <ProjectCard
                        key={project.id}
                        project={project}
                        onDelete={onDeleteProject}
                        onUpdate={onUpdateProject}
                      />
                    ))}
                  </SortableContext>
                  
                  {columnProjects.length === 0 && (
                    <div className="border border-dashed rounded-lg p-4 text-center text-gray-400 text-sm h-24 flex items-center justify-center">
                      No projects yet
                    </div>
                  )}
                </div>
              </DroppableColumn>
            );
          })}
        </div>
        
        {draggingProject && createPortal(
          <DragOverlay>
            <Card className="shadow-lg opacity-80 w-[300px]">
              <div className="p-3">
                <h4 className="text-sm font-medium">{draggingProject.title}</h4>
                <p className="text-xs text-gray-500 line-clamp-2 mt-1">
                  {draggingProject.description || 'No description'}
                </p>
              </div>
            </Card>
          </DragOverlay>,
          document.body
        )}
      </DndContext>
    </div>
  );
}
