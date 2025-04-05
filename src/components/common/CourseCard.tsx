
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Course } from "@/types";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import EnrollmentBadge from "@/components/course/EnrollmentBadge";

interface CourseCardProps {
  course: Course;
}

const CourseCard = ({ course }: CourseCardProps) => {
  const { user } = useAuth();
  const isEnrolled = user?.enrolledCourses?.includes(course.id);
  
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="p-0">
        <div className="relative h-48 w-full">
          <img 
            src={course.thumbnail || "/placeholder.svg"} 
            alt={course.title}
            className="w-full h-full object-cover rounded-t-lg"
          />
          <div className="absolute top-2 right-2 flex gap-2">
            <Badge variant="secondary">{course.level}</Badge>
            <Badge>{course.category}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 flex-grow">
        <div className="mb-2">
          <h3 className="font-bold text-lg line-clamp-2">{course.title}</h3>
          <p className="text-sm text-muted-foreground">
            Instructor: {course.instructor.name}
          </p>
        </div>
        <p className="text-sm line-clamp-3 mb-2">{course.description}</p>
        <div className="mt-auto flex flex-wrap gap-1">
          {course.tags.map((tag) => (
            <Badge key={tag} variant="outline" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>
      </CardContent>
      <CardFooter className="p-4 pt-0 flex justify-between items-center">
        <div className="text-sm">
          <div className="flex items-center gap-1">
            <span>⭐ {course.rating.toFixed(1)}</span>
            <span className="text-muted-foreground">•</span>
            <span>{course.enrollmentCount} students</span>
          </div>
          <div>{course.duration}</div>
        </div>
        
        {isEnrolled ? (
          <EnrollmentBadge courseId={course.id} />
        ) : (
          <Button asChild>
            <Link to={`/courses/${course.id}`}>View Course</Link>
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};

export default CourseCard;
