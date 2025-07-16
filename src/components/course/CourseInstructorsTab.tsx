
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Trash } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { CourseInstructor } from '@/types';

import { createLogger } from '@/utils/logger';

const logger = createLogger('CourseInstructorsTab');

interface CourseInstructorsTabProps {
  courseId: string;
}

interface Profile {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  avatarUrl?: string;
}

const CourseInstructorsTab = ({ courseId }: CourseInstructorsTabProps) => {
  const [instructors, setInstructors] = useState<CourseInstructor[]>([]);
  const [availableProfiles, setAvailableProfiles] = useState<Profile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchInstructors();
    fetchAvailableProfiles();
  }, [courseId]);

  const fetchInstructors = async () => {
    try {
      const { data, error } = await supabase
        .from('course_instructors')
        .select(`
          *,
          profile:profiles(
            id,
            first_name,
            last_name,
            avatar_url,
            email
          )
        `)
        .eq('course_id', courseId);

      if (error) {
        logger.error('Error fetching instructors:', error);
        return;
      }

      const formattedInstructors = data.map((instructor): CourseInstructor => ({
        userId: instructor.user_id,
        courseId: instructor.course_id,
        role: instructor.role,
        profile: instructor.profile ? {
          id: instructor.profile.id,
          firstName: instructor.profile.first_name,
          lastName: instructor.profile.last_name,
          email: instructor.profile.email,
          avatarUrl: instructor.profile.avatar_url,
        } : undefined
      }));

      setInstructors(formattedInstructors);
    } catch (error) {
      logger.error('Error fetching instructors:', error);
    }
  };

  const fetchAvailableProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          first_name,
          last_name,
          avatar_url,
          email
        `);

      if (error) {
        logger.error('Error fetching profiles:', error);
        return;
      }

      const formattedProfiles = data.map((profile): Profile => ({
        id: profile.id,
        firstName: profile.first_name,
        lastName: profile.last_name,
        email: profile.email,
        avatarUrl: profile.avatar_url,
      }));

      setAvailableProfiles(formattedProfiles);
    } catch (error) {
      logger.error('Error fetching profiles:', error);
    }
  };

  const addInstructor = async () => {
    if (!selectedProfileId) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select an instructor",
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('course_instructors')
        .insert([
          {
            course_id: courseId,
            user_id: selectedProfileId,
            role: 'instructor',
          },
        ])
        .select();

      if (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to add instructor. They may already be assigned to this course.",
        });
        logger.error('Error adding instructor:', error);
        return;
      }

      toast({
        title: "Success",
        description: "Instructor added successfully",
      });
      
      setIsDialogOpen(false);
      setSelectedProfileId('');
      fetchInstructors();
    } catch (error) {
      logger.error('Error adding instructor:', error);
    }
  };

  const removeInstructor = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('course_instructors')
        .delete()
        .eq('course_id', courseId)
        .eq('user_id', userId);

      if (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to remove instructor",
        });
        logger.error('Error removing instructor:', error);
        return;
      }

      toast({
        title: "Success",
        description: "Instructor removed successfully",
      });
      
      fetchInstructors();
    } catch (error) {
      logger.error('Error removing instructor:', error);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Course Instructors</h3>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Instructor
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Instructor</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label htmlFor="instructor-select" className="text-sm font-medium">
                  Select Instructor
                </label>
                <Select
                  value={selectedProfileId}
                  onValueChange={setSelectedProfileId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select an instructor" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableProfiles.map((profile) => (
                      <SelectItem key={profile.id} value={profile.id}>
                        {profile.firstName} {profile.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={addInstructor}>Add Instructor</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {instructors.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-4">
                  No instructors assigned to this course
                </TableCell>
              </TableRow>
            ) : (
              instructors.map((instructor) => (
                <TableRow key={instructor.userId}>
                  <TableCell>
                    {instructor.profile?.firstName} {instructor.profile?.lastName}
                  </TableCell>
                  <TableCell>{instructor.profile?.email}</TableCell>
                  <TableCell>{instructor.role}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeInstructor(instructor.userId)}
                    >
                      <Trash className="h-4 w-4 text-destructive" />
                      <span className="sr-only">Remove</span>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default CourseInstructorsTab;
