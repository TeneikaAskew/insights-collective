
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useCoursePermissions } from '@/hooks/useCoursePermissions';
import { ChevronLeft, UserPlus, X, Search } from 'lucide-react';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '@/components/ui/table';
import { 
  Dialog, DialogContent, DialogDescription, DialogFooter, 
  DialogHeader, DialogTitle, DialogTrigger 
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useCourseAssignments } from '@/hooks/useCourseAssignments';
import { useUsers } from '@/hooks/useUsers';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

const CourseInstructors = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAdmin, loading: permissionsLoading } = useCoursePermissions(courseId);
  
  const [course, setCourse] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isAddInstructorOpen, setIsAddInstructorOpen] = useState(false);
  const [instructorToRemove, setInstructorToRemove] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const { 
    assignments, 
    loading: assignmentsLoading, 
    addInstructor, 
    removeInstructor
  } = useCourseAssignments(courseId);
  
  const { 
    users, 
    loading: usersLoading, 
    updateSearchQuery
  } = useUsers(searchQuery);
  
  // Fetch course data
  useEffect(() => {
    if (!courseId) return;
    
    const fetchCourse = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('courses')
          .select('*')
          .eq('id', courseId)
          .single();
        
        if (error) throw error;
        setCourse(data);
      } catch (error: any) {
        console.error('Error fetching course:', error);
        toast({
          title: 'Error',
          description: 'Failed to load course details',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };
    
    // Check permissions before fetching
    if (!permissionsLoading) {
      if (isAdmin) {
        fetchCourse();
      } else {
        toast({
          title: 'Access Denied',
          description: 'Only admins can manage course instructors',
          variant: 'destructive',
        });
        navigate(`/courses/${courseId}`);
      }
    }
  }, [courseId, isAdmin, permissionsLoading, toast, navigate]);
  
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value;
    setSearchQuery(newQuery);
    updateSearchQuery(newQuery);
  };
  
  const handleAddInstructor = async (userId: string) => {
    const result = await addInstructor(userId, 'instructor');
    if (result) {
      setIsAddInstructorOpen(false);
      toast({
        title: 'Instructor Added',
        description: 'The instructor has been added to the course.',
      });
    }
  };
  
  const handleRemoveInstructor = async () => {
    if (!instructorToRemove) return;
    
    const success = await removeInstructor(instructorToRemove.id);
    if (success) {
      setInstructorToRemove(null);
      toast({
        title: 'Instructor Removed',
        description: 'The instructor has been removed from the course.',
      });
    }
  };
  
  // Filter out users who are already instructors
  const filteredUsers = users.filter(user => {
    // Check if user is already an instructor for this course
    const isAlreadyInstructor = assignments.some(
      assignment => assignment.user_id === user.id
    );
    return !isAlreadyInstructor;
  });
  
  if (permissionsLoading || loading) {
    return (
      <AppLayout>
        <div className="container mx-auto p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/4"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
        </div>
      </AppLayout>
    );
  }
  
  return (
    <AppLayout>
      <div className="container mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-4">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => navigate(`/courses/${courseId}`)}
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Back to Course
            </Button>
            <h1 className="text-2xl font-bold">Manage Instructors</h1>
          </div>
          
          <Dialog open={isAddInstructorOpen} onOpenChange={setIsAddInstructorOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="h-4 w-4 mr-2" />
                Add Instructor
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add Instructor</DialogTitle>
                <DialogDescription>
                  Search and select a user to add as an instructor for this course.
                </DialogDescription>
              </DialogHeader>
              
              <div className="relative my-4">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search users..."
                  className="pl-8"
                  value={searchQuery}
                  onChange={handleSearchChange}
                />
              </div>
              
              <div className="max-h-[300px] overflow-y-auto border rounded-md">
                {usersLoading ? (
                  <div className="p-4 text-center">Loading users...</div>
                ) : filteredUsers.length > 0 ? (
                  <Table>
                    <TableBody>
                      {filteredUsers.map(user => (
                        <TableRow key={user.id} className="cursor-pointer hover:bg-muted" onClick={() => handleAddInstructor(user.id)}>
                          <TableCell className="flex items-center space-x-3">
                            <Avatar>
                              <AvatarImage src={user.avatar_url || ''} />
                              <AvatarFallback>
                                {user.first_name?.[0]}{user.last_name?.[0]}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{user.first_name} {user.last_name}</p>
                              <p className="text-sm text-muted-foreground">{user.role || 'Student'}</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="p-4 text-center">No users found</div>
                )}
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddInstructorOpen(false)}>
                  Cancel
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        
        {course && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>{course.title}</CardTitle>
              <CardDescription>{course.description}</CardDescription>
            </CardHeader>
          </Card>
        )}
        
        <Card>
          <CardHeader>
            <CardTitle>Instructors</CardTitle>
            <CardDescription>
              Manage the instructors for this course.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {assignmentsLoading ? (
              <div className="text-center py-4">Loading instructors...</div>
            ) : assignments.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignments.map(assignment => (
                    <TableRow key={assignment.id}>
                      <TableCell className="flex items-center space-x-3">
                        <Avatar>
                          <AvatarImage src={assignment.profile?.avatar_url || ''} />
                          <AvatarFallback>
                            {assignment.profile?.first_name?.[0]}{assignment.profile?.last_name?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{assignment.profile?.first_name} {assignment.profile?.last_name}</p>
                        </div>
                      </TableCell>
                      <TableCell>{assignment.role}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setInstructorToRemove(assignment)}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <X className="h-4 w-4" />
                          <span className="sr-only">Remove</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No instructors assigned yet.</p>
                <Button 
                  variant="outline" 
                  className="mt-4"
                  onClick={() => setIsAddInstructorOpen(true)}
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add Instructor
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
        
        <AlertDialog open={!!instructorToRemove} onOpenChange={(open) => !open && setInstructorToRemove(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove Instructor</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to remove this instructor from the course? 
                They will lose access to manage this course.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleRemoveInstructor} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
};

export default CourseInstructors;
