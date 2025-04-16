
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useCourseAssignments } from '@/hooks/useCourseAssignments';
import { useUsers } from '@/hooks/useUsers';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Trash2, UserPlus } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface InstructorAssignmentProps {
  courseId: string;
  instructorId?: string;
  onInstructorUpdate?: (instructorId: string) => void;
}

const InstructorAssignment = ({ 
  courseId, 
  instructorId,
  onInstructorUpdate
}: InstructorAssignmentProps) => {
  const { toast } = useToast();
  const { assignments, addInstructor, removeInstructor, loading: assignmentsLoading } = useCourseAssignments(courseId);
  const { users, loading: usersLoading } = useUsers();
  const [primaryInstructor, setPrimaryInstructor] = useState<string | undefined>(instructorId);
  const [saving, setSaving] = useState(false);
  
  // Filter out users who are already assigned
  const availableUsers = users.filter(u => 
    !assignments.some(a => a.user_id === u.id)
  );
  
  const handlePrimaryInstructorChange = async (userId: string) => {
    if (!courseId) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('courses')
        .update({ instructor_id: userId })
        .eq('id', courseId);
      
      if (error) throw error;
      
      setPrimaryInstructor(userId);
      if (onInstructorUpdate) {
        onInstructorUpdate(userId);
      }
      
      toast({
        title: 'Success',
        description: 'Primary instructor updated successfully',
      });
    } catch (error: any) {
      console.error('Error updating primary instructor:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update primary instructor',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };
  
  const handleAssignInstructor = async (userId: string) => {
    if (!userId) return;
    
    const result = await addInstructor(userId);
    if (result && !primaryInstructor) {
      // If no primary instructor is set, set this one as primary
      handlePrimaryInstructorChange(userId);
    }
  };
  
  if (assignmentsLoading || usersLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Course Instructors</CardTitle>
          <CardDescription>
            Loading instructor information...
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="py-8">
            <Progress value={30} className="w-full animate-pulse" />
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Primary Instructor</CardTitle>
          <CardDescription>
            Select the primary instructor for this course. This instructor will be displayed as the main course instructor.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Label>Primary Instructor</Label>
            <Select 
              value={primaryInstructor || ''} 
              onValueChange={handlePrimaryInstructorChange}
              disabled={saving}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select primary instructor" />
              </SelectTrigger>
              <SelectContent>
                {assignments.length > 0 ? (
                  assignments.map(assignment => (
                    <SelectItem key={assignment.user_id} value={assignment.user_id}>
                      {assignment.profile?.first_name} {assignment.profile?.last_name}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="" disabled>No instructors assigned</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Course Instructors</CardTitle>
          <CardDescription>
            Manage instructors for this course. Instructors can create and edit course content.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <Label>Assigned Instructors</Label>
            {assignments.length > 0 ? (
              <div className="space-y-2">
                {assignments.map(assignment => (
                  <div 
                    key={assignment.id} 
                    className="flex items-center justify-between p-3 border rounded-md"
                  >
                    <div className="flex items-center space-x-3">
                      <Avatar>
                        <AvatarImage 
                          src={assignment.profile?.avatar_url || ''} 
                          alt={`${assignment.profile?.first_name || ''} ${assignment.profile?.last_name || ''}`} 
                        />
                        <AvatarFallback>
                          {(assignment.profile?.first_name?.[0] || '') + 
                           (assignment.profile?.last_name?.[0] || '')}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">
                          {assignment.profile?.first_name} {assignment.profile?.last_name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {assignment.role}
                          {primaryInstructor === assignment.user_id && " (Primary Instructor)"}
                        </p>
                      </div>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => removeInstructor(assignment.id)}
                      disabled={primaryInstructor === assignment.user_id}
                      title={primaryInstructor === assignment.user_id ? "Cannot remove primary instructor" : "Remove instructor"}
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Remove</span>
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-4 text-center text-muted-foreground">
                No instructors assigned yet.
              </div>
            )}
          </div>
          
          <div className="space-y-4">
            <Label htmlFor="add-instructor">Add Instructor</Label>
            <div className="flex space-x-2">
              <Select 
                onValueChange={(userId) => {
                  if (userId) {
                    handleAssignInstructor(userId);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a user" />
                </SelectTrigger>
                <SelectContent>
                  {availableUsers.length > 0 ? (
                    availableUsers.map(u => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.first_name} {u.last_name}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="" disabled>No available users</SelectItem>
                  )}
                </SelectContent>
              </Select>
              <Button 
                variant="outline"
                disabled={availableUsers.length === 0}
                onClick={() => document.querySelector<HTMLButtonElement>('[id^="radix-:"]')?.click()}
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Add Instructor
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default InstructorAssignment;
