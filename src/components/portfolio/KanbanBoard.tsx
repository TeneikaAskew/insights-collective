
import React, { useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { usePortfolio } from '@/hooks/usePortfolio';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
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

  // Handle drag end event
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over || active.id === over.id) {
      setDraggingProject(null);
      return;
    }
    
    // Find the new status column
    const projectId = active.id as string;
    const targetColumn = over.id as ProjectStatus;
    
    if (!statusColumns.map(col => col.id).includes(targetColumn)) {
      setDraggingProject(null);
      return;
    }
    
    // Call the parent status change handler
    onStatusChange(projectId, targetColumn);
    
    // Update the local state optimistically
    const updatedProjects = localProjects.map(project => {
      if (project.id === projectId) {
        return { ...project, status: targetColumn };
      }
      return project;
    });
    
    setLocalProjects(updatedProjects);
    setDraggingProject(null);
  };

  // Start dragging
  const handleDragStart = (event: any) => {
    const projectId = event.active.id;
    const project = localProjects.find((p) => p.id === projectId);
    if (project) {
      setDraggingProject(project);
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
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        sensors={sensors}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {statusColumns.map((column) => {
            const columnProjects = getProjectsByStatus(column.id);
            
            return (
              <div
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
              </div>
            );
          })}
        </div>
        
        {draggingProject && createPortal(
          <div className="fixed top-0 left-0 bg-black bg-opacity-50 w-full h-full flex items-center justify-center z-50">
            <div className="bg-white p-4 rounded-lg shadow-lg max-w-md">
              <h3 className="text-lg font-medium">Moving: {draggingProject.title}</h3>
              <p className="text-gray-500 text-sm">Drag to the desired column</p>
            </div>
          </div>,
          document.body
        )}
      </DndContext>
    </div>
  );
}
