
import { useState, useEffect } from 'react';
import { useToast } from './use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { isValidUUID } from '@/utils/idUtils';

type CourseAssignment = {
  id: string;
  user_id: string;
  course_id: string;
  role: string;
  created_at: string;
  profile?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
  };
};

export function useCourseAssignments(courseId?: string) {
  const [assignments, setAssignments] = useState<CourseAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  
  useEffect(() => {
    if (!courseId) {
      setLoading(false);
      return;
    }
    
    // Validate UUID format
    if (!isValidUUID(courseId)) {
      console.error(`Invalid course UUID format: ${courseId}`);
      setError('Invalid course ID format');
      setLoading(false);
      toast({
        title: 'Error',
        description: 'Invalid course ID format',
        variant: 'destructive',
      });
      return;
    }
    
    const fetchAssignments = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const { data, error } = await supabase
          .from('course_assignments')
          .select(`
            *,
            profile:profiles(id, first_name, last_name, avatar_url)
          `)
          .eq('course_id', courseId);
        
        if (error) throw error;
        setAssignments(data || []);
      } catch (error: any) {
        console.error('Error fetching course assignments:', error);
        setError(error.message || 'Failed to load course instructors');
        toast({
          title: 'Error',
          description: 'Failed to load course instructors',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchAssignments();
  }, [courseId, toast]);
  
  const addInstructor = async (userId: string, role: 'instructor' | 'admin' = 'instructor') => {
    if (!courseId || !userId) return null;
    
    // Validate UUID format
    if (!isValidUUID(courseId) || !isValidUUID(userId)) {
      console.error(`Invalid UUID format - courseId: ${courseId}, userId: ${userId}`);
      toast({
        title: 'Error',
        description: 'Invalid ID format',
        variant: 'destructive',
      });
      return null;
    }
    
    try {
      const { data, error } = await supabase
        .from('course_assignments')
        .insert({
          user_id: userId,
          course_id: courseId,
          role
        })
        .select()
        .single();
      
      if (error) throw error;
      
      // Fetch the profile info for the newly added instructor
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, avatar_url')
        .eq('id', userId)
        .single();
      
      if (profileError) throw profileError;
      
      const newAssignment = {
        ...data,
        profile: profileData
      };
      
      setAssignments(prev => [...prev, newAssignment]);
      
      toast({
        title: 'Success',
        description: 'Instructor added successfully',
      });
      
      return newAssignment;
    } catch (error: any) {
      console.error('Error adding instructor:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to add instructor',
        variant: 'destructive',
      });
      return null;
    }
  };
  
  const removeInstructor = async (assignmentId: string) => {
    if (!assignmentId) return false;
    
    // Validate UUID format
    if (!isValidUUID(assignmentId)) {
      console.error(`Invalid assignment UUID format: ${assignmentId}`);
      toast({
        title: 'Error',
        description: 'Invalid assignment ID format',
        variant: 'destructive',
      });
      return false;
    }
    
    try {
      const { error } = await supabase
        .from('course_assignments')
        .delete()
        .eq('id', assignmentId);
      
      if (error) throw error;
      
      setAssignments(prev => prev.filter(a => a.id !== assignmentId));
      
      toast({
        title: 'Success',
        description: 'Instructor removed successfully',
      });
      
      return true;
    } catch (error: any) {
      console.error('Error removing instructor:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to remove instructor',
        variant: 'destructive',
      });
      return false;
    }
  };
  
  // Check if current user is assigned to this course
  const isUserAssigned = user ? assignments.some(a => a.user_id === user.id) : false;
  
  return {
    assignments,
    loading,
    error,
    addInstructor,
    removeInstructor,
    isUserAssigned
  };
}
