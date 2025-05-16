
import React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UserProject } from '@/hooks/usePortfolioExplorer';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface KanbanBoardProps {
  projects: UserProject[];
  onUpdateStatus: (projectId: string, newStatus: 'Idea' | 'Planned' | 'In Progress' | 'Completed') => void;
}

// The available columns in our kanban board
const columns: { id: 'Idea' | 'Planned' | 'In Progress' | 'Completed'; title: string }[] = [
  { id: 'Idea', title: 'Ideas' },
  { id: 'Planned', title: 'Planned' },
  { id: 'In Progress', title: 'In Progress' },
  { id: 'Completed', title: 'Completed' }
];

const KanbanBoard: React.FC<KanbanBoardProps> = ({ projects, onUpdateStatus }) => {
  const [activeProject, setActiveProject] = React.useState<UserProject | null>(null);
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const activeProject = projects.find(p => p.id === active.id);
    if (activeProject) {
      setActiveProject(activeProject);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      // If dragged over a column, update the project status
      const columnId = over.id.toString() as 'Idea' | 'Planned' | 'In Progress' | 'Completed';
      const projectId = active.id.toString();
      
      if (columns.some(col => col.id === columnId)) {
        onUpdateStatus(projectId, columnId);
      }
    }
    
    setActiveProject(null);
  };

  // Group projects by status
  const projectsByColumn = columns.reduce((acc, column) => {
    acc[column.id] = projects.filter(project => project.status === column.id);
    return acc;
  }, {} as Record<string, UserProject[]>);

  return (
    <DndContext 
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-4 gap-4 h-full">
        {columns.map(column => (
          <KanbanColumn 
            key={column.id}
            column={column}
            projects={projectsByColumn[column.id] || []}
          />
        ))}
      </div>
      
      <DragOverlay>
        {activeProject ? (
          <ProjectCard project={activeProject} />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};

interface KanbanColumnProps {
  column: { id: 'Idea' | 'Planned' | 'In Progress' | 'Completed'; title: string };
  projects: UserProject[];
}

const KanbanColumn: React.FC<KanbanColumnProps> = ({ column, projects }) => {
  return (
    <div 
      className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 h-full min-h-[500px]"
      id={column.id}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium">{column.title}</h3>
        <Badge variant="secondary">{projects.length}</Badge>
      </div>
      
      <div className="space-y-3">
        <SortableContext items={projects.map(p => p.id)} strategy={verticalListSortingStrategy}>
          {projects.map((project) => (
            <SortableProjectCard key={project.id} project={project} />
          ))}
        </SortableContext>
        
        {projects.length === 0 && (
          <div className="h-20 border border-dashed rounded-lg flex items-center justify-center text-sm text-gray-500">
            No projects
          </div>
        )}
      </div>
    </div>
  );
};

interface ProjectCardProps {
  project: UserProject;
}

const ProjectCard: React.FC<ProjectCardProps> = ({ project }) => {
  return (
    <Card className="bg-white dark:bg-gray-700 shadow-sm">
      <CardHeader className="p-3 pb-1">
        <CardTitle className="text-sm font-medium">{project.title}</CardTitle>
      </CardHeader>
      <CardContent className="p-3 pt-1 pb-1">
        <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-2">
          {project.description}
        </p>
        
        {project.requiredSkills.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {project.requiredSkills.slice(0, 3).map((skill) => (
              <Badge key={skill} variant="outline" className="text-xs px-1 py-0">
                {skill}
              </Badge>
            ))}
            {project.requiredSkills.length > 3 && (
              <Badge variant="outline" className="text-xs px-1 py-0">
                +{project.requiredSkills.length - 3}
              </Badge>
            )}
          </div>
        )}
      </CardContent>
      <CardFooter className="p-3 pt-1 flex justify-between">
        <span className="text-xs text-gray-500">{project.effortLevel}</span>
      </CardFooter>
    </Card>
  );
};

const SortableProjectCard: React.FC<ProjectCardProps> = ({ project }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({
    id: project.id,
  });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  
  return (
    <div 
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="cursor-grab"
    >
      <ProjectCard project={project} />
    </div>
  );
};

export default KanbanBoard;
