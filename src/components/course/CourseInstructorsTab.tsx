
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { UserWithProfile } from '@/types/supabase';
import { Loader2, Plus, Trash2, UserPlus } from 'lucide-react';

type Instructor = {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
  role: string;
};

interface CourseInstructorsTabProps {
  courseId: string;
}

export const CourseInstructorsTab = ({ courseId }: CourseInstructorsTabProps) => {
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [availableUsers, setAvailableUsers] = useState<UserWithProfile[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchCourseInstructors();
    fetchAvailableUsers();
  }, [courseId]);

  const fetchCourseInstructors = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('course_assignments')
        .select(`
          id,
          role,
          user_id,
          profiles:profiles(
            id,
            first_name,
            last_name,
            avatar_url,
            email:users!auth.users(email)
          )
        `)
        .eq('course_id', courseId)
        .eq('role', 'instructor');

      if (error) throw error;

      const instructorsList = data?.map(item => ({
        id: item.user_id,
        name: `${item.profiles.first_name || ''} ${item.profiles.last_name || ''}`.trim(),
        avatar: item.profiles.avatar_url,
        email: item.profiles.email?.[0]?.email,
        role: item.role
      })) || [];

      setInstructors(instructorsList);
    } catch (error) {
      console.error('Error fetching instructors:', error);
      toast({
        title: 'Error',
        description: 'Failed to load course instructors',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableUsers = async () => {
    try {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select(`
          id,
          first_name,
          last_name,
          avatar_url,
          role,
          email:users!auth.users(email)
        `)
        .or('role.eq.instructor,role.eq.admin');

      if (error) throw error;

      // Format the data
      const users = profiles.map(profile => ({
        id: profile.id,
        name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim(),
        avatar: profile.avatar_url,
        email: profile.email?.[0]?.email,
        role: profile.role
      })) as UserWithProfile[];

      // Filter out users who are already instructors for this course
      const filteredUsers = users.filter(
        user => !instructors.some(instructor => instructor.id === user.id)
      );

      setAvailableUsers(filteredUsers);
    } catch (error) {
      console.error('Error fetching available users:', error);
    }
  };

  const handleAddInstructor = async () => {
    if (!selectedUserId) return;

    try {
      setAdding(true);
      const { data, error } = await supabase
        .from('course_assignments')
        .insert({
          course_id: courseId,
          user_id: selectedUserId,
          role: 'instructor'
        })
        .select();

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Instructor added to course',
      });

      // Refresh the instructors list
      fetchCourseInstructors();
      setSelectedUserId('');
      fetchAvailableUsers();
    } catch (error) {
      console.error('Error adding instructor:', error);
      toast({
        title: 'Error',
        description: 'Failed to add instructor',
        variant: 'destructive',
      });
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveInstructor = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('course_assignments')
        .delete()
        .eq('course_id', courseId)
        .eq('user_id', userId)
        .eq('role', 'instructor');

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Instructor removed from course',
      });

      // Refresh the instructors list
      fetchCourseInstructors();
      fetchAvailableUsers();
    } catch (error) {
      console.error('Error removing instructor:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove instructor',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Add Instructors</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <Select
                value={selectedUserId}
                onValueChange={setSelectedUserId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select an instructor" />
                </SelectTrigger>
                <SelectContent>
                  {availableUsers.map(user => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name} {user.email ? `(${user.email})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button 
              onClick={handleAddInstructor} 
              disabled={!selectedUserId || adding}
            >
              {adding ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add Instructor
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Current Instructors</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : instructors.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No instructors have been assigned to this course yet.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Instructor</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {instructors.map(instructor => (
                  <TableRow key={instructor.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={instructor.avatar || undefined} alt={instructor.name} />
                          <AvatarFallback>
                            {instructor.name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span>{instructor.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>{instructor.email}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveInstructor(instructor.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Remove
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
