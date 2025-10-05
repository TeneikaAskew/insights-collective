
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Search, Pencil, Plus } from 'lucide-react';
import { useCoursesManagement } from '@/hooks/useCoursesManagement';
import AppLayout from '@/components/layout/AppLayout';
import { Spinner } from '@/components/ui/spinner';
import { useState } from 'react';

const CourseManagementDashboard = () => {
  const { courses, loading } = useCoursesManagement();
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  const filteredCourses = courses.filter((course) =>
    course.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <AppLayout>
        <div className="flex justify-center items-center h-[50vh]">
          <Spinner size="lg" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Course Management</h1>
            <p className="text-muted-foreground">Manage your courses here.</p>
          </div>
          <Button onClick={() => navigate('/admin/courses')}>
            <Plus className="h-4 w-4 mr-2" />
            View All Courses
          </Button>
        </div>

        <div>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search courses..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Level</TableHead>
                <TableHead>Instructor</TableHead>
                <TableHead>Students</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCourses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-4 text-muted-foreground">
                    No courses found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredCourses.map((course) => (
                  <TableRow key={course.id}>
                    <TableCell className="font-medium">{course.title}</TableCell>
                    <TableCell>{course.category}</TableCell>
                    <TableCell>{course.level}</TableCell>
                    <TableCell>
                      {course.instructor ? (
                        <span>{course.instructor.name}</span>
                      ) : (
                        <span className="text-muted-foreground">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell>{course.enrollmentCount || 0}</TableCell>
                    <TableCell>
                      {course.published ? (
                        <Badge>Published</Badge>
                      ) : (
                        <Badge variant="secondary">Draft</Badge>
                      )}
                    </TableCell>
                    <TableCell>{new Date(course.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/courses/${course.id}/management`)}
                      >
                        <Pencil className="h-4 w-4 mr-2" />
                        Manage
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </AppLayout>
  );
};

export default CourseManagementDashboard;
