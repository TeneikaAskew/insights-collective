
import { Link } from 'react-router-dom';
import { Course } from '@/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { BookOpen, Clock, Users, Star } from 'lucide-react';

interface CourseCardProps {
  course: Course;
  progress?: number;
}

const CourseCard = ({ course, progress }: CourseCardProps) => {
  return (
    <Link to={`/courses/${course.id}`}>
      <Card className="h-full overflow-hidden hover:shadow-lg transition-all duration-200">
        <div className="aspect-video w-full overflow-hidden">
          <img 
            src={course.thumbnail} 
            alt={course.title} 
            className="w-full h-full object-cover"
          />
        </div>
        
        <CardHeader className="p-4">
          <div className="flex justify-between items-start">
            <CardTitle className="text-xl">{course.title}</CardTitle>
            <Badge variant={
              course.enrollmentStatus === 'Open' ? 'default' :
              course.enrollmentStatus === 'In Progress' ? 'secondary' : 'outline'
            }>
              {course.enrollmentStatus}
            </Badge>
          </div>
          <CardDescription className="mt-2 line-clamp-2">{course.description}</CardDescription>
        </CardHeader>
        
        <CardContent className="p-4 pt-0">
          <div className="flex flex-wrap gap-2 mb-3">
            {course.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
            {course.tags.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{course.tags.length - 3}
              </Badge>
            )}
          </div>
          
          <div className="flex items-center text-muted-foreground text-sm gap-4 mb-3">
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>{course.duration}</span>
            </div>
            <div className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              <span>{course.enrollmentCount}</span>
            </div>
            <div className="flex items-center gap-1">
              <Star className="h-4 w-4 text-yellow-500" />
              <span>{course.rating.toFixed(1)}</span>
            </div>
          </div>
          
          {progress !== undefined && (
            <div className="mt-2">
              <div className="flex justify-between text-sm mb-1">
                <span>Progress</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}
        </CardContent>
        
        <CardFooter className="p-4 pt-0 flex justify-between text-sm">
          <div className="text-muted-foreground">{course.level}</div>
          <div className="flex items-center">
            <BookOpen className="h-4 w-4 mr-1" />
            <span>{course.modules.length} modules</span>
          </div>
        </CardFooter>
      </Card>
    </Link>
  );
};

export default CourseCard;
