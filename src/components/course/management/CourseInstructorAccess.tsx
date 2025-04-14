
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useCoursePermissions } from '@/hooks/useCoursePermissions';
import { useCourseAssignments } from '@/hooks/useCourseAssignments';
import { Edit, Book, FileText } from 'lucide-react';

interface CourseInstructorAccessProps {
  courseId: string;
  title: string;
  description: string;
}

const CourseInstructorAccess: React.FC<CourseInstructorAccessProps> = ({
  courseId,
  title,
  description
}) => {
  const navigate = useNavigate();
  const { canEdit, isInstructor, loading: permissionsLoading } = useCoursePermissions(courseId);
  const { isUserAssigned } = useCourseAssignments(courseId);
  
  const handleEditCourse = () => {
    navigate(`/courses/${courseId}/edit`);
  };
  
  const handleManageModules = () => {
    navigate(`/courses/${courseId}/modules/manage`);
  };
  
  const handleManageMaterials = () => {
    navigate(`/courses/${courseId}/materials`);
  };
  
  if (permissionsLoading) {
    return <div className="p-4">Checking permissions...</div>;
  }
  
  if (!canEdit && !isInstructor && !isUserAssigned) {
    return null;
  }
  
  return (
    <Card className="mb-6 border-amber-200 bg-amber-50">
      <CardHeader>
        <CardTitle className="text-amber-800">Instructor Access</CardTitle>
        <CardDescription>
          You have instructor privileges for this course
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <p className="text-sm text-amber-700">Course: {title}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2">
        <Button 
          variant="outline" 
          onClick={handleEditCourse}
          className="border-amber-500 text-amber-700 hover:bg-amber-100"
        >
          <Edit className="mr-2 h-4 w-4" />
          Edit Course
        </Button>
        <Button 
          variant="outline" 
          onClick={handleManageModules}
          className="border-amber-500 text-amber-700 hover:bg-amber-100"
        >
          <Book className="mr-2 h-4 w-4" />
          Manage Modules
        </Button>
        <Button 
          variant="outline" 
          onClick={handleManageMaterials}
          className="border-amber-500 text-amber-700 hover:bg-amber-100"
        >
          <FileText className="mr-2 h-4 w-4" />
          Edit Materials
        </Button>
      </CardFooter>
    </Card>
  );
};

export default CourseInstructorAccess;
