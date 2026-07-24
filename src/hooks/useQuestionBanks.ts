import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { questionBankService } from '@/services/questionBankService';
import { QuestionBank, QuestionBankQuestion, QuestionBankCategory, QuizQuestionPool } from '@/types/course';
import { toast } from 'sonner';

// Question Banks hooks
export const useQuestionBanks = (courseId?: string) => {
  const queryClient = useQueryClient();

  const { data: banks, isLoading, error, refetch } = useQuery({
    queryKey: ['question-banks', courseId],
    queryFn: () => questionBankService.getQuestionBanks(courseId!),
    enabled: !!courseId,
  });

  const createBankMutation = useMutation({
    mutationFn: (bank: Omit<QuestionBank, 'id' | 'created_at' | 'updated_at'>) =>
      questionBankService.createQuestionBank(bank),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['question-banks', courseId] });
      toast.success('Question bank created successfully');
    },
    onError: () => {
      toast.error('Failed to create question bank');
    },
  });

  const updateBankMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<QuestionBank> }) =>
      questionBankService.updateQuestionBank(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['question-banks', courseId] });
      toast.success('Question bank updated successfully');
    },
    onError: () => {
      toast.error('Failed to update question bank');
    },
  });

  const deleteBankMutation = useMutation({
    mutationFn: (bankId: string) => questionBankService.deleteQuestionBank(bankId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['question-banks', courseId] });
      toast.success('Question bank deleted successfully');
    },
    onError: () => {
      toast.error('Failed to delete question bank');
    },
  });

  return {
    banks,
    isLoading,
    error,
    refetch,
    createBank: createBankMutation.mutate,
    updateBank: updateBankMutation.mutate,
    deleteBank: deleteBankMutation.mutate,
  };
};

// Questions hooks
export const useQuestionBankQuestions = (bankId?: string, filters?: any) => {
  const queryClient = useQueryClient();

  const { data: questions, isLoading, error } = useQuery({
    queryKey: ['bank-questions', bankId, filters],
    queryFn: () => questionBankService.getQuestions(bankId!, filters),
    enabled: !!bankId,
  });

  const createQuestionMutation = useMutation({
    mutationFn: (question: Omit<QuestionBankQuestion, 'id' | 'created_at' | 'updated_at' | 'usage_count'>) =>
      questionBankService.createQuestion(question),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-questions', bankId] });
      toast.success('Question created successfully');
    },
    onError: () => {
      toast.error('Failed to create question');
    },
  });

  const updateQuestionMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<QuestionBankQuestion> }) =>
      questionBankService.updateQuestion(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-questions', bankId] });
      toast.success('Question updated successfully');
    },
    onError: () => {
      toast.error('Failed to update question');
    },
  });

  const deleteQuestionMutation = useMutation({
    mutationFn: (questionId: string) => questionBankService.deleteQuestion(questionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-questions', bankId] });
      toast.success('Question deleted successfully');
    },
    onError: () => {
      toast.error('Failed to delete question');
    },
  });

  const bulkCreateQuestionsMutation = useMutation({
    mutationFn: (questions: Array<Omit<QuestionBankQuestion, 'id' | 'created_at' | 'updated_at' | 'usage_count'>>) =>
      questionBankService.bulkCreateQuestions(questions),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-questions', bankId] });
      toast.success('Questions imported successfully');
    },
    onError: () => {
      toast.error('Failed to import questions');
    },
  });

  return {
    questions,
    isLoading,
    error,
    createQuestion: createQuestionMutation.mutate,
    updateQuestion: updateQuestionMutation.mutate,
    deleteQuestion: deleteQuestionMutation.mutate,
    bulkCreateQuestions: bulkCreateQuestionsMutation.mutate,
  };
};

// Categories hooks
export const useQuestionBankCategories = (bankId?: string) => {
  const queryClient = useQueryClient();

  const { data: categories, isLoading, error } = useQuery({
    queryKey: ['bank-categories', bankId],
    queryFn: () => questionBankService.getCategories(bankId!),
    enabled: !!bankId,
  });

  const createCategoryMutation = useMutation({
    mutationFn: (category: Omit<QuestionBankCategory, 'id' | 'created_at'>) =>
      questionBankService.createCategory(category),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-categories', bankId] });
      toast.success('Category created successfully');
    },
    onError: () => {
      toast.error('Failed to create category');
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<QuestionBankCategory> }) =>
      questionBankService.updateCategory(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-categories', bankId] });
      toast.success('Category updated successfully');
    },
    onError: () => {
      toast.error('Failed to update category');
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: (categoryId: string) => questionBankService.deleteCategory(categoryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-categories', bankId] });
      toast.success('Category deleted successfully');
    },
    onError: () => {
      toast.error('Failed to delete category');
    },
  });

  return {
    categories,
    isLoading,
    error,
    createCategory: createCategoryMutation.mutate,
    updateCategory: updateCategoryMutation.mutate,
    deleteCategory: deleteCategoryMutation.mutate,
  };
};

// Question Pools hooks
export const useQuizQuestionPools = (quizId?: string) => {
  const queryClient = useQueryClient();

  const { data: pools, isLoading, error } = useQuery({
    queryKey: ['quiz-question-pools', quizId],
    queryFn: () => questionBankService.getQuizQuestionPools(quizId!),
    enabled: !!quizId,
  });

  const createPoolMutation = useMutation({
    mutationFn: (pool: Omit<QuizQuestionPool, 'id' | 'created_at'>) =>
      questionBankService.createQuestionPool(pool),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quiz-question-pools', quizId] });
      toast.success('Question pool created successfully');
    },
    onError: () => {
      toast.error('Failed to create question pool');
    },
  });

  const updatePoolMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<QuizQuestionPool> }) =>
      questionBankService.updateQuestionPool(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quiz-question-pools', quizId] });
      toast.success('Question pool updated successfully');
    },
    onError: () => {
      toast.error('Failed to update question pool');
    },
  });

  const deletePoolMutation = useMutation({
    mutationFn: (poolId: string) => questionBankService.deleteQuestionPool(poolId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quiz-question-pools', quizId] });
      toast.success('Question pool deleted successfully');
    },
    onError: () => {
      toast.error('Failed to delete question pool');
    },
  });

  return {
    pools,
    isLoading,
    error,
    createPool: createPoolMutation.mutate,
    updatePool: updatePoolMutation.mutate,
    deletePool: deletePoolMutation.mutate,
  };
};