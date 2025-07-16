import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { assignmentService } from '@/services/assignmentService';
import { useToast } from '@/hooks/use-toast';
import { AssignmentSubmission, EnhancedAssignment } from '@/types/course';

export const useAssignments = (courseId?: string) => {
  return useQuery({
    queryKey: ['assignments', courseId],
    queryFn: () => courseId ? assignmentService.getAssignmentsByCourse(courseId) : Promise.resolve([]),
    enabled: !!courseId,
  });
};

export const useAssignment = (assignmentId: string) => {
  return useQuery({
    queryKey: ['assignment', assignmentId],
    queryFn: () => assignmentService.getAssignment(assignmentId),
    enabled: !!assignmentId,
  });
};

export const useCreateAssignment = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (assignment: Partial<EnhancedAssignment>) => 
      assignmentService.createAssignment(assignment),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
      toast({
        title: 'Success',
        description: 'Assignment created successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
};

export const useUpdateAssignment = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<EnhancedAssignment> }) =>
      assignmentService.updateAssignment(id, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
      queryClient.invalidateQueries({ queryKey: ['assignment', data.id] });
      toast({
        title: 'Success',
        description: 'Assignment updated successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
};

export const useDeleteAssignment = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (id: string) => assignmentService.deleteAssignment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
      toast({
        title: 'Success',
        description: 'Assignment deleted successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
};

// Submission hooks
export const useSubmission = (assignmentId: string, studentId: string) => {
  return useQuery({
    queryKey: ['submission', assignmentId, studentId],
    queryFn: () => assignmentService.getSubmission(assignmentId, studentId),
    enabled: !!assignmentId && !!studentId,
  });
};

export const useSubmissions = (assignmentId: string) => {
  return useQuery({
    queryKey: ['submissions', assignmentId],
    queryFn: () => assignmentService.getSubmissionsByAssignment(assignmentId),
    enabled: !!assignmentId,
  });
};

export const useSubmitAssignment = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ assignmentId, studentId, submissionData }: {
      assignmentId: string;
      studentId: string;
      submissionData: any;
    }) => assignmentService.submitAssignment(assignmentId, studentId, submissionData),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['submission', data.assignment_id, data.student_id] });
      queryClient.invalidateQueries({ queryKey: ['submissions', data.assignment_id] });
      toast({
        title: 'Success',
        description: 'Assignment submitted successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
};

export const useGradeSubmission = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ submissionId, grade, feedback, graderId }: {
      submissionId: string;
      grade: number;
      feedback: string | null;
      graderId: string;
    }) => assignmentService.gradeSubmission(submissionId, grade, feedback, graderId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['submission'] });
      queryClient.invalidateQueries({ queryKey: ['submissions'] });
      queryClient.invalidateQueries({ queryKey: ['grades'] });
      toast({
        title: 'Success',
        description: 'Assignment graded successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
};

// Rubric hooks
export const useCreateRubric = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (rubric: any) => assignmentService.createRubric(rubric),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rubrics'] });
      toast({
        title: 'Success',
        description: 'Rubric created successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
};

export const useAttachRubric = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ assignmentId, rubricId }: { assignmentId: string; rubricId: string }) =>
      assignmentService.attachRubricToAssignment(assignmentId, rubricId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignment'] });
      toast({
        title: 'Success',
        description: 'Rubric attached successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
};