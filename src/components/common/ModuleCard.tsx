
import { Module } from '@/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, Clock, BookOpen, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';

interface ModuleCardProps {
  courseId: string;
  module: Module;
}

const ModuleCard = ({ courseId, module }: ModuleCardProps) => {
  const totalItems = module.lessons.length + module.assignments.length + module.quizzes.length;
  
  return (
    <Link to={`/courses/${courseId}/modules/${module.id}`}>
      <Card className="h-full hover:shadow-md transition-all duration-200">
        <CardHeader className="pb-2">
          <div className="flex justify-between items-start gap-2">
            <CardTitle className="text-lg">{module.title}</CardTitle>
            <div className="flex items-center justify-center rounded-full bg-primary/10 w-8 h-8 text-primary font-semibold">
              {module.week}
            </div>
          </div>
          <CardDescription className="mt-1 line-clamp-2">{module.description}</CardDescription>
        </CardHeader>
        
        <CardContent className="pb-2">
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-sm mb-1">
              <span>Completion</span>
              <span>{module.completionStatus}%</span>
            </div>
            <Progress value={module.completionStatus} className="h-2" />
            
            <div className="grid grid-cols-3 gap-2 mt-2">
              <div className="flex flex-col items-center justify-center p-2 bg-secondary rounded-lg">
                <BookOpen className="h-4 w-4 mb-1" />
                <span className="text-xs">{module.lessons.length} Lessons</span>
              </div>
              
              <div className="flex flex-col items-center justify-center p-2 bg-secondary rounded-lg">
                <FileText className="h-4 w-4 mb-1" />
                <span className="text-xs">{module.assignments.length} Assignments</span>
              </div>
              
              <div className="flex flex-col items-center justify-center p-2 bg-secondary rounded-lg">
                <Clock className="h-4 w-4 mb-1" />
                <span className="text-xs">{module.quizzes.length} Quizzes</span>
              </div>
            </div>
          </div>
        </CardContent>
        
        <CardFooter className="pt-0 flex justify-between items-center">
          {module.completionStatus === 100 ? (
            <div className="flex items-center text-green-500 text-sm">
              <CheckCircle className="h-4 w-4 mr-1" />
              <span>Completed</span>
            </div>
          ) : (
            <div className="text-muted-foreground text-sm">
              {totalItems} items total
            </div>
          )}
        </CardFooter>
      </Card>
    </Link>
  );
};

export default ModuleCard;
