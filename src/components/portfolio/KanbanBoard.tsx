
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
  rectIntersection,
  useDroppable,
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

import { createLogger } from '@/utils/logger';

const logger = createLogger('KanbanBoard');

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
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div 
      ref={setNodeRef} 
      className={`${className} ${isOver ? 'ring-2 ring-blue-400 ring-opacity-50' : ''}`}
    >
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

  // Configure sensors for drag and drop with better sensitivity
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 8,
      },
    })
  );

  // Handle drag start to set the currently dragged project
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const projectId = active.id as string;
    const project = localProjects.find(p => p.id === projectId);
    
    logger.log('Drag started for project:', projectId, project);
    
    if (project) {
      setDraggingProject(project);
    }
  };

  // Handle drag end to update project status
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    logger.log('Drag ended:', { active: active?.id, over: over?.id });
    
    setDraggingProject(null);
    
    if (!over || !active) {
      logger.log('No valid drop target or active item');
      return;
    }
    
    const projectId = active.id as string;
    const newStatus = over.id as ProjectStatus;
    
    // Validate that the new status is a valid ProjectStatus
    const validStatuses: ProjectStatus[] = ['Idea', 'Planned', 'In Progress', 'Completed'];
    if (!validStatuses.includes(newStatus)) {
      logger.log('Invalid drop target:', newStatus);
      return;
    }
    
    // Only update if the status actually changed
    const project = localProjects.find(p => p.id === projectId);
    if (project && project.status !== newStatus) {
      logger.log('Updating project status:', projectId, 'from', project.status, 'to', newStatus);
      
      // Optimistically update local state first
      setLocalProjects(prevProjects => 
        prevProjects.map(p => 
          p.id === projectId 
            ? { ...p, status: newStatus }
            : p
        )
      );
      
      // Call parent handler to update status in database
      onStatusChange(projectId, newStatus);
      
      // Show toast notification
      toast({
        title: "Status updated",
        description: `Project moved to ${newStatus}`,
      });
    }
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
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        collisionDetection={rectIntersection}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {statusColumns.map((column) => {
            const columnProjects = getProjectsByStatus(column.id);
            
            return (
              <DroppableColumn
                key={column.id}
                id={column.id}
                className={`rounded-lg p-3 ${column.color} border min-h-[300px] transition-all duration-200`}
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
                        onStatusChange={onStatusChange}
                        isKanbanView={true}
                      />
                    ))}
                  </SortableContext>
                  
                  {columnProjects.length === 0 && (
                    <div className="border border-dashed rounded-lg p-4 text-center text-gray-400 text-sm h-24 flex items-center justify-center">
                      Drop projects here
                    </div>
                  )}
                </div>
              </DroppableColumn>
            );
          })}
        </div>
        
        {draggingProject && createPortal(
          <DragOverlay>
            <div className="opacity-80 rotate-3 scale-105">
              <Card className="p-3 shadow-lg border-2 border-blue-400">
                <p className="font-medium">{draggingProject.title}</p>
                <p className="text-sm text-gray-500 mt-1">
                  {draggingProject.description && draggingProject.description.length > 50 
                    ? draggingProject.description.substring(0, 50) + '...' 
                    : draggingProject.description || 'No description'}
                </p>
              </Card>
            </div>
          </DragOverlay>,
          document.body
        )}
      </DndContext>
    </div>
  );
}
