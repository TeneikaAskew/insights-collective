import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { rubricService } from '@/services/rubricService';
import { Rubric, RubricCriteria } from '@/types/course';
import { toast } from 'sonner';

export const useRubrics = (courseId?: string) => {
  const queryClient = useQueryClient();

  const { data: rubrics, isLoading, error } = useQuery({
    queryKey: ['rubrics', courseId],
    queryFn: () => rubricService.getRubricsByCourse(courseId!),
    enabled: !!courseId,
  });

  const createRubricMutation = useMutation({
    mutationFn: (rubric: Omit<Rubric, 'id' | 'created_at' | 'updated_at'>) =>
      rubricService.createRubric(rubric),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rubrics', courseId] });
      toast.success('Rubric created successfully');
    },
    onError: () => {
      toast.error('Failed to create rubric');
    },
  });

  const updateRubricMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Rubric> }) =>
      rubricService.updateRubric(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rubrics', courseId] });
      toast.success('Rubric updated successfully');
    },
    onError: () => {
      toast.error('Failed to update rubric');
    },
  });

  const deleteRubricMutation = useMutation({
    mutationFn: (rubricId: string) => rubricService.deleteRubric(rubricId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rubrics', courseId] });
      toast.success('Rubric deleted successfully');
    },
    onError: () => {
      toast.error('Failed to delete rubric');
    },
  });

  return {
    rubrics,
    isLoading,
    error,
    createRubric: createRubricMutation.mutate,
    updateRubric: updateRubricMutation.mutate,
    deleteRubric: deleteRubricMutation.mutate,
  };
};

export const useRubric = (rubricId?: string) => {
  const queryClient = useQueryClient();

  const { data: rubric, isLoading, error } = useQuery({
    queryKey: ['rubric', rubricId],
    queryFn: () => rubricService.getRubric(rubricId!),
    enabled: !!rubricId,
  });

  const createCriteriaMutation = useMutation({
    mutationFn: (criteria: Omit<RubricCriteria, 'id' | 'created_at'>) =>
      rubricService.createCriteria(criteria),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rubric', rubricId] });
      toast.success('Criteria added successfully');
    },
    onError: () => {
      toast.error('Failed to add criteria');
    },
  });

  const updateCriteriaMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<RubricCriteria> }) =>
      rubricService.updateCriteria(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rubric', rubricId] });
      toast.success('Criteria updated successfully');
    },
    onError: () => {
      toast.error('Failed to update criteria');
    },
  });

  const deleteCriteriaMutation = useMutation({
    mutationFn: (criteriaId: string) => rubricService.deleteCriteria(criteriaId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rubric', rubricId] });
      toast.success('Criteria deleted successfully');
    },
    onError: () => {
      toast.error('Failed to delete criteria');
    },
  });

  const reorderCriteriaMutation = useMutation({
    mutationFn: (criteriaIds: string[]) =>
      rubricService.reorderCriteria(rubricId!, criteriaIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rubric', rubricId] });
    },
    onError: () => {
      toast.error('Failed to reorder criteria');
    },
  });

  return {
    rubric,
    isLoading,
    error,
    createCriteria: createCriteriaMutation.mutate,
    updateCriteria: updateCriteriaMutation.mutate,
    deleteCriteria: deleteCriteriaMutation.mutate,
    reorderCriteria: reorderCriteriaMutation.mutate,
  };
};

export const useAssignmentRubrics = (assignmentId?: string) => {
  const queryClient = useQueryClient();

  const { data: rubrics, isLoading, error } = useQuery({
    queryKey: ['assignment-rubrics', assignmentId],
    queryFn: () => rubricService.getRubricsForAssignment(assignmentId!),
    enabled: !!assignmentId,
  });

  const attachRubricMutation = useMutation({
    mutationFn: (rubricId: string) =>
      rubricService.attachRubricToAssignment(assignmentId!, rubricId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignment-rubrics', assignmentId] });
      toast.success('Rubric attached to assignment');
    },
    onError: () => {
      toast.error('Failed to attach rubric');
    },
  });

  const detachRubricMutation = useMutation({
    mutationFn: (rubricId: string) =>
      rubricService.detachRubricFromAssignment(assignmentId!, rubricId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignment-rubrics', assignmentId] });
      toast.success('Rubric detached from assignment');
    },
    onError: () => {
      toast.error('Failed to detach rubric');
    },
  });

  return {
    rubrics,
    isLoading,
    error,
    attachRubric: attachRubricMutation.mutate,
    detachRubric: detachRubricMutation.mutate,
  };
};