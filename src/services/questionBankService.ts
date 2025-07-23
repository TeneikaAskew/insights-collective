import { supabase } from '@/integrations/supabase/client';
import { QuestionBank, QuestionBankQuestion, QuestionBankCategory, QuizQuestionPool } from '@/types/course';

export const questionBankService = {
  // Question Banks
  async getQuestionBanks(courseId: string): Promise<QuestionBank[]> {
    const { data, error } = await supabase
      .from('question_banks')
      .select(`
        *,
        categories:question_bank_categories(count),
        questions:question_bank_questions(count)
      `)
      .eq('course_id', courseId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    return (data || []).map(bank => ({
      ...bank,
      question_count: bank.questions?.[0]?.count || 0
    }));
  },

  async getQuestionBank(bankId: string): Promise<QuestionBank | null> {
    const { data, error } = await supabase
      .from('question_banks')
      .select(`
        *,
        categories:question_bank_categories(*)
      `)
      .eq('id', bankId)
      .single();

    if (error) throw error;
    return data;
  },

  async createQuestionBank(bank: Omit<QuestionBank, 'id' | 'created_at' | 'updated_at'>): Promise<QuestionBank> {
    const { data, error } = await supabase
      .from('question_banks')
      .insert(bank)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateQuestionBank(bankId: string, updates: Partial<QuestionBank>): Promise<QuestionBank> {
    const { data, error } = await supabase
      .from('question_banks')
      .update(updates)
      .eq('id', bankId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteQuestionBank(bankId: string): Promise<void> {
    const { error } = await supabase
      .from('question_banks')
      .delete()
      .eq('id', bankId);

    if (error) throw error;
  },

  // Questions
  async getQuestions(bankId: string, filters?: {
    category_id?: string;
    difficulty?: string;
    question_type?: string;
    tags?: string[];
  }): Promise<QuestionBankQuestion[]> {
    let query = supabase
      .from('question_bank_questions')
      .select('*')
      .eq('bank_id', bankId);

    if (filters?.difficulty) {
      query = query.eq('difficulty_level', filters.difficulty);
    }

    if (filters?.question_type) {
      query = query.eq('question_type', filters.question_type);
    }

    if (filters?.tags && filters.tags.length > 0) {
      query = query.contains('topic_tags', filters.tags);
    }

    if (filters?.category_id) {
      query = query.select(`
        *,
        question_category_links!inner(category_id)
      `).eq('question_category_links.category_id', filters.category_id);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getQuestion(questionId: string): Promise<QuestionBankQuestion | null> {
    const { data, error } = await supabase
      .from('question_bank_questions')
      .select('*')
      .eq('id', questionId)
      .single();

    if (error) throw error;
    return data;
  },

  async createQuestion(question: Omit<QuestionBankQuestion, 'id' | 'created_at' | 'updated_at' | 'usage_count'>): Promise<QuestionBankQuestion> {
    const { data, error } = await supabase
      .from('question_bank_questions')
      .insert({
        ...question,
        usage_count: 0
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateQuestion(questionId: string, updates: Partial<QuestionBankQuestion>): Promise<QuestionBankQuestion> {
    const { data, error } = await supabase
      .from('question_bank_questions')
      .update(updates)
      .eq('id', questionId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteQuestion(questionId: string): Promise<void> {
    const { error } = await supabase
      .from('question_bank_questions')
      .delete()
      .eq('id', questionId);

    if (error) throw error;
  },

  async bulkCreateQuestions(questions: Array<Omit<QuestionBankQuestion, 'id' | 'created_at' | 'updated_at' | 'usage_count'>>): Promise<QuestionBankQuestion[]> {
    const { data, error } = await supabase
      .from('question_bank_questions')
      .insert(questions.map(q => ({ ...q, usage_count: 0 })))
      .select();

    if (error) throw error;
    return data || [];
  },

  // Categories
  async getCategories(bankId: string): Promise<QuestionBankCategory[]> {
    const { data, error } = await supabase
      .from('question_bank_categories')
      .select(`
        *,
        questions:question_category_links(count)
      `)
      .eq('bank_id', bankId)
      .order('name');

    if (error) throw error;
    
    return (data || []).map(cat => ({
      ...cat,
      question_count: cat.questions?.[0]?.count || 0
    }));
  },

  async createCategory(category: Omit<QuestionBankCategory, 'id' | 'created_at'>): Promise<QuestionBankCategory> {
    const { data, error } = await supabase
      .from('question_bank_categories')
      .insert(category)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateCategory(categoryId: string, updates: Partial<QuestionBankCategory>): Promise<QuestionBankCategory> {
    const { data, error } = await supabase
      .from('question_bank_categories')
      .update(updates)
      .eq('id', categoryId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteCategory(categoryId: string): Promise<void> {
    const { error } = await supabase
      .from('question_bank_categories')
      .delete()
      .eq('id', categoryId);

    if (error) throw error;
  },

  async linkQuestionToCategory(questionId: string, categoryId: string): Promise<void> {
    const { error } = await supabase
      .from('question_category_links')
      .insert({ question_id: questionId, category_id: categoryId });

    if (error) throw error;
  },

  async unlinkQuestionFromCategory(questionId: string, categoryId: string): Promise<void> {
    const { error } = await supabase
      .from('question_category_links')
      .delete()
      .eq('question_id', questionId)
      .eq('category_id', categoryId);

    if (error) throw error;
  },

  // Question Pools
  async getQuizQuestionPools(quizId: string): Promise<QuizQuestionPool[]> {
    const { data, error } = await supabase
      .from('quiz_question_pools')
      .select(`
        *,
        bank:question_banks(title),
        category:question_bank_categories(name)
      `)
      .eq('quiz_id', quizId)
      .order('position');

    if (error) throw error;
    return data || [];
  },

  async createQuestionPool(pool: Omit<QuizQuestionPool, 'id' | 'created_at'>): Promise<QuizQuestionPool> {
    const { data, error } = await supabase
      .from('quiz_question_pools')
      .insert(pool)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateQuestionPool(poolId: string, updates: Partial<QuizQuestionPool>): Promise<QuizQuestionPool> {
    const { data, error } = await supabase
      .from('quiz_question_pools')
      .update(updates)
      .eq('id', poolId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteQuestionPool(poolId: string): Promise<void> {
    const { error } = await supabase
      .from('quiz_question_pools')
      .delete()
      .eq('id', poolId);

    if (error) throw error;
  },

  // Utility functions
  async getRandomQuestions(
    bankId: string,
    count: number,
    filters?: {
      categoryId?: string;
      difficulty?: string;
      tags?: string[];
    }
  ): Promise<QuestionBankQuestion[]> {
    const { data, error } = await supabase
      .rpc('select_random_questions', {
        p_bank_id: bankId,
        p_category_id: filters?.categoryId || null,
        p_count: count,
        p_difficulty: filters?.difficulty || null,
        p_tags: filters?.tags || null
      });

    if (error) throw error;

    // Fetch the full question data
    const questionIds = data.map((row: any) => row.question_id);
    const { data: questions, error: questionsError } = await supabase
      .from('question_bank_questions')
      .select('*')
      .in('id', questionIds);

    if (questionsError) throw questionsError;
    return questions || [];
  },

  async getQuestionStatistics(questionId: string): Promise<{
    usage_count: number;
    success_rate: number;
    average_time: number;
  }> {
    const { data, error } = await supabase
      .from('question_bank_questions')
      .select('usage_count, success_rate')
      .eq('id', questionId)
      .single();

    if (error) throw error;

    // Get average time from attempts
    const { data: timeData, error: timeError } = await supabase
      .from('quiz_attempt_questions')
      .select('time_spent')
      .eq('question_id', questionId);

    if (timeError) throw timeError;

    const avgTime = timeData?.length 
      ? timeData.reduce((sum, item) => sum + (item.time_spent || 0), 0) / timeData.length
      : 0;

    return {
      usage_count: data?.usage_count || 0,
      success_rate: data?.success_rate || 0,
      average_time: avgTime
    };
  }
};