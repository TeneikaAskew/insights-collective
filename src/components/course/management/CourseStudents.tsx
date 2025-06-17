
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Search, Mail, UserX, Download } from 'lucide-react';
import { useCourseEnrollments } from '@/hooks/useCourseEnrollments';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface CourseStudentsProps {
  courseId?: string;
}

const CourseStudents = ({ courseId }: CourseStudentsProps) => {
  const { enrollments, stats, loading, error, refetch } = useCourseEnrollments(courseId);
  const [searchTerm, setSearchTerm] = useState('');
  const [unenrolling, setUnenrolling] = useState<string | null>(null);
  const { toast } = useToast();

  const filteredEnrollments = enrollments.filter(enrollment => {
    if (!enrollment.user) return false;
    const fullName = `${enrollment.user.first_name} ${enrollment.user.last_name}`.toLowerCase();
    return fullName.includes(searchTerm.toLowerCase()) || 
           enrollment.user.email?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const handleUnenroll = async (enrollmentId: string, userName: string) => {
    if (!confirm(`Are you sure you want to unenroll ${userName} from this course?`)) {
      return;
    }

    setUnenrolling(enrollmentId);
    try {
      const { error } = await supabase
        .from('enrollments')
        .delete()
        .eq('id', enrollmentId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: `${userName} has been unenrolled from the course.`,
      });

      refetch();
    } catch (error: any) {
      console.error('Error unenrolling student:', error);
      toast({
        title: 'Error',
        description: 'Failed to unenroll student. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setUnenrolling(null);
    }
  };

  const exportEnrollments = () => {
    const csv = [
      ['Name', 'Email', 'Enrolled Date', 'Completion Status'],
      ...filteredEnrollments.map(enrollment => [
        `${enrollment.user?.first_name || ''} ${enrollment.user?.last_name || ''}`.trim(),
        enrollment.user?.email || '',
        new Date(enrollment.enrolled_at).toLocaleDateString(),
        `${enrollment.completion_status}%`
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `course-enrollments-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-gray-200 rounded w-1/4"></div>
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 rounded"></div>
                <div className="h-4 bg-gray-200 rounded w-5/6"></div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <p className="text-red-600">Error loading enrollment data: {error}</p>
            <Button onClick={refetch} className="mt-2">
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Total Enrollments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.enrollment_count || enrollments.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Average Completion</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.completion_rate || 0}%</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Active Students</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {enrollments.filter(e => e.completion_status < 100).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Student Management */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Enrolled Students</CardTitle>
              <CardDescription>
                Manage students enrolled in this course
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button onClick={exportEnrollments} variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search students by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Students List */}
            {filteredEnrollments.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">
                  {searchTerm ? 'No students found matching your search.' : 'No students enrolled in this course yet.'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredEnrollments.map((enrollment) => (
                  <div
                    key={enrollment.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex items-center space-x-4">
                      <Avatar>
                        <AvatarImage src={enrollment.user?.avatar_url} />
                        <AvatarFallback>
                          {`${enrollment.user?.first_name?.[0] || ''}${enrollment.user?.last_name?.[0] || ''}`}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <h4 className="font-medium">
                            {`${enrollment.user?.first_name || ''} ${enrollment.user?.last_name || ''}`.trim() || 'Unknown User'}
                          </h4>
                          {enrollment.completion_status === 100 && (
                            <Badge variant="secondary">Completed</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {enrollment.user?.email || 'No email available'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Enrolled: {new Date(enrollment.enrolled_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-4">
                      <div className="text-right space-y-1">
                        <div className="text-sm font-medium">
                          {enrollment.completion_status}% Complete
                        </div>
                        <Progress 
                          value={enrollment.completion_status} 
                          className="w-20 h-2"
                        />
                      </div>
                      
                      <div className="flex space-x-2">
                        <Button variant="outline" size="sm">
                          <Mail className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleUnenroll(
                            enrollment.id,
                            `${enrollment.user?.first_name || ''} ${enrollment.user?.last_name || ''}`.trim()
                          )}
                          disabled={unenrolling === enrollment.id}
                        >
                          <UserX className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CourseStudents;
