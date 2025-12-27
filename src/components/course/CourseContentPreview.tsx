// ABOUTME: Displays a preview of course modules with week numbers and titles
// ABOUTME: Used on the course detail page to show course structure before enrollment

import { BookOpen, CheckCircle } from 'lucide-react';

interface Module {
  id: string;
  title: string;
  week: number;
  published: boolean;
}

interface CourseContentPreviewProps {
  modules: Module[];
}

export function CourseContentPreview({ modules }: CourseContentPreviewProps) {
  const publishedModules = modules.filter(m => m.published);
  
  if (publishedModules.length === 0) {
    return null;
  }

  return (
    <div className="mt-6 border-t pt-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <BookOpen className="h-5 w-5 text-primary" />
        What You'll Learn
      </h3>
      <p className="text-sm text-muted-foreground mb-4">
        This course includes {publishedModules.length} module{publishedModules.length !== 1 ? 's' : ''}
      </p>
      <ul className="space-y-3">
        {publishedModules.map((module, index) => (
          <li key={module.id} className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
              {module.week || index + 1}
            </div>
            <div className="flex-1 pt-1">
              <p className="font-medium">{module.title}</p>
              <p className="text-sm text-muted-foreground">
                Week {module.week || index + 1}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
