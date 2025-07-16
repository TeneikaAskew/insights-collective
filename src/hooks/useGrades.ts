import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { gradeService } from '@/services/gradeService';
import { useToast } from '@/hooks/use-toast';
import { Grade } from '@/types/course';

export const useGradesByCourse = (courseId: string) => {
  return useQuery({
    queryKey: ['grades', 'course', courseId],
    queryFn: () => gradeService.getGradesByCourse(courseId),
    enabled: !!courseId,
  });
};

export const useStudentGrades = (courseId: string, studentId: string) => {
  return useQuery({
    queryKey: ['grades', 'student', courseId, studentId],
    queryFn: () => gradeService.getStudentGrades(courseId, studentId),
    enabled: !!courseId && !!studentId,
  });
};

export const useCourseGrade = (courseId: string, studentId: string) => {
  return useQuery({
    queryKey: ['course-grade', courseId, studentId],
    queryFn: () => gradeService.calculateCourseGrade(courseId, studentId),
    enabled: !!courseId && !!studentId,
  });
};

export const useUpsertGrade = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (grade: Partial<Grade>) => gradeService.upsertGrade(grade),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['grades'] });
      queryClient.invalidateQueries({ queryKey: ['course-grade'] });
      toast({
        title: 'Success',
        description: 'Grade updated successfully',
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

export const useBulkUpdateGrades = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (grades: Partial<Grade>[]) => gradeService.bulkUpdateGrades(grades),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grades'] });
      queryClient.invalidateQueries({ queryKey: ['course-grade'] });
      toast({
        title: 'Success',
        description: 'Grades updated successfully',
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

export const useCourseStatistics = (courseId: string) => {
  return useQuery({
    queryKey: ['grade-statistics', courseId],
    queryFn: () => gradeService.getCourseStatistics(courseId),
    enabled: !!courseId,
  });
};

export const useExportGrades = () => {
  const { toast } = useToast();

  return useMutation({
    mutationFn: (courseId: string) => gradeService.exportGradesToCSV(courseId),
    onSuccess: (csvData) => {
      // Create and download CSV file
      const blob = new Blob([csvData], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `grades-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: 'Success',
        description: 'Grades exported successfully',
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

export const useImportGrades = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ courseId, csvData, graderId }: {
      courseId: string;
      csvData: string;
      graderId: string;
    }) => gradeService.importGradesFromCSV(courseId, csvData, graderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grades'] });
      toast({
        title: 'Success',
        description: 'Grades imported successfully',
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