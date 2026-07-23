// ABOUTME: Unit tests for Question Bank Service
// ABOUTME: Verifies CRUD methods throw on supabase errors and that category
// ABOUTME: filtering in getQuestions really filters via question_category_links.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { questionBankService } from '../questionBankService';
import { mockSupabaseClient, supabaseError, getQueryBuilder } from '@/test/mocks/supabase';

function makeQuestion(overrides: Record<string, unknown> = {}) {
  return {
    id: 'q-1',
    bank_id: 'bank-1',
    question_type: 'multiple_choice',
    question_text: 'What is 2 + 2?',
    difficulty_level: 'easy',
    topic_tags: ['math'],
    points: 5,
    usage_count: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeBank(overrides: Record<string, unknown> = {}) {
  return {
    id: 'bank-1',
    course_id: 'c1',
    title: 'Midterm Bank',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

// Chainable builder that resolves `result` when the awaited chain settles.
// Used for multi-table tests via from.mockImplementation((table) => ...).
function makeBuilder(result: { data: unknown; error: unknown }) {
  const builder: any = {};
  for (const method of [
    'select', 'insert', 'update', 'delete', 'upsert',
    'eq', 'neq', 'is', 'in', 'not', 'contains', 'order', 'limit',
  ]) {
    builder[method] = vi.fn(() => builder);
  }
  builder.single = vi.fn().mockResolvedValue(result);
  builder.maybeSingle = vi.fn().mockResolvedValue(result);
  builder.then = vi.fn((onFulfilled: (value: unknown) => unknown) =>
    Promise.resolve(result).then(onFulfilled)
  );
  return builder;
}

describe('questionBankService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('question banks', () => {
    it('getQuestionBanks returns banks with derived question counts', async () => {
      mockSupabaseClient.from().select().eq().order.mockResolvedValue({
        data: [
          makeBank({ questions: [{ count: 7 }] }),
          makeBank({ id: 'bank-2', questions: [] }),
        ],
        error: null,
      });

      const result = await questionBankService.getQuestionBanks('c1');

      expect(result).toHaveLength(2);
      expect(result[0].question_count).toBe(7);
      expect(result[1].question_count).toBe(0);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('question_banks');
    });

    it('getQuestionBanks returns an empty array for a course with no banks', async () => {
      mockSupabaseClient.from().select().eq().order.mockResolvedValue({
        data: [],
        error: null,
      });

      await expect(questionBankService.getQuestionBanks('c1')).resolves.toEqual([]);
    });

    it('getQuestionBanks rejects on query failure', async () => {
      mockSupabaseClient.from().select().eq().order.mockResolvedValue(supabaseError('db down'));

      await expect(questionBankService.getQuestionBanks('c1')).rejects.toMatchObject({
        message: 'db down',
      });
    });

    it('getQuestionBank returns a single bank', async () => {
      const bank = makeBank();
      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: bank,
        error: null,
      });

      await expect(questionBankService.getQuestionBank('bank-1')).resolves.toEqual(bank);
    });

    it('getQuestionBank rejects on failure', async () => {
      mockSupabaseClient.from().select().eq().single.mockResolvedValue(supabaseError('db down'));

      await expect(questionBankService.getQuestionBank('bank-1')).rejects.toMatchObject({
        message: 'db down',
      });
    });

    it('createQuestionBank inserts and returns the bank', async () => {
      const bank = makeBank();
      mockSupabaseClient.from().insert().select().single.mockResolvedValue({
        data: bank,
        error: null,
      });

      await expect(
        questionBankService.createQuestionBank({ course_id: 'c1', title: 'Midterm Bank' } as never)
      ).resolves.toEqual(bank);
    });

    it('createQuestionBank rejects on insert failure', async () => {
      mockSupabaseClient.from().insert().select().single.mockResolvedValue(
        supabaseError('db down')
      );

      await expect(
        questionBankService.createQuestionBank({ course_id: 'c1', title: 'Midterm Bank' } as never)
      ).rejects.toMatchObject({ message: 'db down' });
    });

    it('updateQuestionBank updates and returns the bank', async () => {
      const bank = makeBank({ title: 'Final Bank' });
      mockSupabaseClient.from().update().eq().select().single.mockResolvedValue({
        data: bank,
        error: null,
      });

      const result = await questionBankService.updateQuestionBank('bank-1', {
        title: 'Final Bank',
      });

      expect(result.title).toBe('Final Bank');
    });

    it('updateQuestionBank rejects on failure', async () => {
      mockSupabaseClient.from().update().eq().select().single.mockResolvedValue(
        supabaseError('db down')
      );

      await expect(
        questionBankService.updateQuestionBank('bank-1', { title: 'Final Bank' })
      ).rejects.toMatchObject({ message: 'db down' });
    });

    it('deleteQuestionBank resolves without error', async () => {
      mockSupabaseClient.from().delete().eq.mockResolvedValue({ error: null });

      await expect(questionBankService.deleteQuestionBank('bank-1')).resolves.toBeUndefined();
    });

    it('deleteQuestionBank rejects on failure', async () => {
      mockSupabaseClient.from().delete().eq.mockResolvedValue(supabaseError('db down'));

      await expect(questionBankService.deleteQuestionBank('bank-1')).rejects.toMatchObject({
        message: 'db down',
      });
    });
  });

  describe('getQuestions', () => {
    it('returns questions for a bank without filters', async () => {
      const questions = [makeQuestion(), makeQuestion({ id: 'q-2' })];
      mockSupabaseClient.from().select().eq().order.mockResolvedValue({
        data: questions,
        error: null,
      });

      const result = await questionBankService.getQuestions('bank-1');

      expect(result).toEqual(questions);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('question_bank_questions');
    });

    it('applies difficulty, type, and tag filters server-side', async () => {
      const questions = [makeQuestion()];
      const builder = getQueryBuilder();
      builder.order.mockResolvedValue({ data: questions, error: null });

      const result = await questionBankService.getQuestions('bank-1', {
        difficulty: 'easy',
        question_type: 'multiple_choice',
        tags: ['math'],
      });

      expect(result).toEqual(questions);
      expect(builder.eq).toHaveBeenCalledWith('difficulty_level', 'easy');
      expect(builder.eq).toHaveBeenCalledWith('question_type', 'multiple_choice');
      expect(builder.contains).toHaveBeenCalledWith('topic_tags', ['math']);
    });

    it('returns an empty array when the bank has no questions', async () => {
      mockSupabaseClient.from().select().eq().order.mockResolvedValue({
        data: null,
        error: null,
      });

      await expect(questionBankService.getQuestions('bank-1')).resolves.toEqual([]);
    });

    it('rejects on query failure', async () => {
      mockSupabaseClient.from().select().eq().order.mockResolvedValue(supabaseError('db down'));

      await expect(questionBankService.getQuestions('bank-1')).rejects.toMatchObject({
        message: 'db down',
      });
    });

    it('filters by category via question_category_links (no silent no-op)', async () => {
      const linked = [makeQuestion({ id: 'q-1' }), makeQuestion({ id: 'q-3' })];
      const questionsBuilder = makeBuilder({ data: linked, error: null });
      const linksBuilder = makeBuilder({
        data: [{ question_id: 'q-1' }, { question_id: 'q-3' }],
        error: null,
      });
      (mockSupabaseClient.from as ReturnType<typeof vi.fn>).mockImplementation(
        (table: string) =>
          table === 'question_category_links' ? linksBuilder : questionsBuilder
      );

      const result = await questionBankService.getQuestions('bank-1', {
        category_id: 'cat-1',
      });

      expect(result).toEqual(linked);
      expect(linksBuilder.eq).toHaveBeenCalledWith('category_id', 'cat-1');
      expect(questionsBuilder.in).toHaveBeenCalledWith('id', ['q-1', 'q-3']);
    });

    it('returns an empty array when the category has no linked questions', async () => {
      const questionsBuilder = makeBuilder({ data: [makeQuestion()], error: null });
      const linksBuilder = makeBuilder({ data: [], error: null });
      (mockSupabaseClient.from as ReturnType<typeof vi.fn>).mockImplementation(
        (table: string) =>
          table === 'question_category_links' ? linksBuilder : questionsBuilder
      );

      const result = await questionBankService.getQuestions('bank-1', {
        category_id: 'cat-empty',
      });

      expect(result).toEqual([]);
      // The main question query must not run unconstrained.
      expect(questionsBuilder.then).not.toHaveBeenCalled();
    });

    it('rejects when the category link lookup fails', async () => {
      const questionsBuilder = makeBuilder({ data: [], error: null });
      const linksBuilder = makeBuilder(supabaseError('links down'));
      (mockSupabaseClient.from as ReturnType<typeof vi.fn>).mockImplementation(
        (table: string) =>
          table === 'question_category_links' ? linksBuilder : questionsBuilder
      );

      await expect(
        questionBankService.getQuestions('bank-1', { category_id: 'cat-1' })
      ).rejects.toMatchObject({ message: 'links down' });
    });
  });

  describe('question CRUD', () => {
    it('getQuestion returns a single question', async () => {
      const question = makeQuestion();
      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: question,
        error: null,
      });

      await expect(questionBankService.getQuestion('q-1')).resolves.toEqual(question);
    });

    it('getQuestion rejects on failure', async () => {
      mockSupabaseClient.from().select().eq().single.mockResolvedValue(supabaseError('db down'));

      await expect(questionBankService.getQuestion('q-1')).rejects.toMatchObject({
        message: 'db down',
      });
    });

    it('createQuestion inserts with usage_count reset to 0', async () => {
      const question = makeQuestion();
      const builder = mockSupabaseClient.from();
      builder.insert().select().single.mockResolvedValue({ data: question, error: null });

      const result = await questionBankService.createQuestion({
        bank_id: 'bank-1',
        question_type: 'multiple_choice',
        question_text: 'What is 2 + 2?',
      } as never);

      expect(result).toEqual(question);
      expect(builder.insert).toHaveBeenCalledWith(
        expect.objectContaining({ usage_count: 0 })
      );
    });

    it('createQuestion rejects on insert failure', async () => {
      mockSupabaseClient.from().insert().select().single.mockResolvedValue(
        supabaseError('db down')
      );

      await expect(
        questionBankService.createQuestion({ bank_id: 'bank-1' } as never)
      ).rejects.toMatchObject({ message: 'db down' });
    });

    it('updateQuestion updates and returns the question', async () => {
      const updated = makeQuestion({ question_text: 'What is 3 + 3?' });
      mockSupabaseClient.from().update().eq().select().single.mockResolvedValue({
        data: updated,
        error: null,
      });

      const result = await questionBankService.updateQuestion('q-1', {
        question_text: 'What is 3 + 3?',
      });

      expect(result.question_text).toBe('What is 3 + 3?');
    });

    it('updateQuestion rejects on failure', async () => {
      mockSupabaseClient.from().update().eq().select().single.mockResolvedValue(
        supabaseError('db down')
      );

      await expect(
        questionBankService.updateQuestion('q-1', { question_text: 'x' })
      ).rejects.toMatchObject({ message: 'db down' });
    });

    it('deleteQuestion resolves without error', async () => {
      mockSupabaseClient.from().delete().eq.mockResolvedValue({ error: null });

      await expect(questionBankService.deleteQuestion('q-1')).resolves.toBeUndefined();
    });

    it('deleteQuestion rejects on failure', async () => {
      mockSupabaseClient.from().delete().eq.mockResolvedValue(supabaseError('db down'));

      await expect(questionBankService.deleteQuestion('q-1')).rejects.toMatchObject({
        message: 'db down',
      });
    });

    it('bulkCreateQuestions inserts and returns all questions', async () => {
      const questions = [makeQuestion(), makeQuestion({ id: 'q-2' })];
      mockSupabaseClient.from().insert().select.mockResolvedValue({
        data: questions,
        error: null,
      });

      const result = await questionBankService.bulkCreateQuestions([
        { bank_id: 'bank-1' } as never,
        { bank_id: 'bank-1' } as never,
      ]);

      expect(result).toEqual(questions);
    });

    it('bulkCreateQuestions returns an empty array when insert returns no rows', async () => {
      mockSupabaseClient.from().insert().select.mockResolvedValue({ data: null, error: null });

      await expect(questionBankService.bulkCreateQuestions([])).resolves.toEqual([]);
    });

    it('bulkCreateQuestions rejects on failure', async () => {
      mockSupabaseClient.from().insert().select.mockResolvedValue(supabaseError('db down'));

      await expect(
        questionBankService.bulkCreateQuestions([{ bank_id: 'bank-1' } as never])
      ).rejects.toMatchObject({ message: 'db down' });
    });
  });

  describe('categories', () => {
    it('getCategories returns categories with derived question counts', async () => {
      mockSupabaseClient.from().select().eq().order.mockResolvedValue({
        data: [
          { id: 'cat-1', bank_id: 'bank-1', name: 'Algebra', questions: [{ count: 3 }] },
          { id: 'cat-2', bank_id: 'bank-1', name: 'Geometry', questions: [] },
        ],
        error: null,
      });

      const result = await questionBankService.getCategories('bank-1');

      expect(result[0].question_count).toBe(3);
      expect(result[1].question_count).toBe(0);
    });

    it('getCategories returns an empty array for a bank with no categories', async () => {
      mockSupabaseClient.from().select().eq().order.mockResolvedValue({
        data: [],
        error: null,
      });

      await expect(questionBankService.getCategories('bank-1')).resolves.toEqual([]);
    });

    it('getCategories rejects on failure', async () => {
      mockSupabaseClient.from().select().eq().order.mockResolvedValue(supabaseError('db down'));

      await expect(questionBankService.getCategories('bank-1')).rejects.toMatchObject({
        message: 'db down',
      });
    });

    it('createCategory inserts and returns the category', async () => {
      const category = { id: 'cat-1', bank_id: 'bank-1', name: 'Algebra' };
      mockSupabaseClient.from().insert().select().single.mockResolvedValue({
        data: category,
        error: null,
      });

      await expect(
        questionBankService.createCategory({ bank_id: 'bank-1', name: 'Algebra' } as never)
      ).resolves.toEqual(category);
    });

    it('createCategory rejects on failure', async () => {
      mockSupabaseClient.from().insert().select().single.mockResolvedValue(
        supabaseError('db down')
      );

      await expect(
        questionBankService.createCategory({ bank_id: 'bank-1', name: 'Algebra' } as never)
      ).rejects.toMatchObject({ message: 'db down' });
    });

    it('updateCategory updates and returns the category', async () => {
      const updated = { id: 'cat-1', name: 'Advanced Algebra' };
      mockSupabaseClient.from().update().eq().select().single.mockResolvedValue({
        data: updated,
        error: null,
      });

      const result = await questionBankService.updateCategory('cat-1', {
        name: 'Advanced Algebra',
      });

      expect(result.name).toBe('Advanced Algebra');
    });

    it('updateCategory rejects on failure', async () => {
      mockSupabaseClient.from().update().eq().select().single.mockResolvedValue(
        supabaseError('db down')
      );

      await expect(
        questionBankService.updateCategory('cat-1', { name: 'x' })
      ).rejects.toMatchObject({ message: 'db down' });
    });

    it('deleteCategory resolves without error', async () => {
      mockSupabaseClient.from().delete().eq.mockResolvedValue({ error: null });

      await expect(questionBankService.deleteCategory('cat-1')).resolves.toBeUndefined();
    });

    it('deleteCategory rejects on failure', async () => {
      mockSupabaseClient.from().delete().eq.mockResolvedValue(supabaseError('db down'));

      await expect(questionBankService.deleteCategory('cat-1')).rejects.toMatchObject({
        message: 'db down',
      });
    });

    it('linkQuestionToCategory resolves without error', async () => {
      mockSupabaseClient.from().insert.mockResolvedValue({ error: null });

      await expect(
        questionBankService.linkQuestionToCategory('q-1', 'cat-1')
      ).resolves.toBeUndefined();
    });

    it('linkQuestionToCategory rejects on failure', async () => {
      mockSupabaseClient.from().insert.mockResolvedValue(supabaseError('db down'));

      await expect(
        questionBankService.linkQuestionToCategory('q-1', 'cat-1')
      ).rejects.toMatchObject({ message: 'db down' });
    });

    it('unlinkQuestionFromCategory resolves without error', async () => {
      // Chain is .delete().eq().eq(): first eq keeps chaining, second resolves.
      const builder = getQueryBuilder();
      builder.eq.mockImplementationOnce(() => builder);
      builder.eq.mockResolvedValueOnce({ error: null });

      await expect(
        questionBankService.unlinkQuestionFromCategory('q-1', 'cat-1')
      ).resolves.toBeUndefined();
    });

    it('unlinkQuestionFromCategory rejects on failure', async () => {
      const builder = getQueryBuilder();
      builder.eq.mockImplementationOnce(() => builder);
      builder.eq.mockResolvedValueOnce(supabaseError('db down'));

      await expect(
        questionBankService.unlinkQuestionFromCategory('q-1', 'cat-1')
      ).rejects.toMatchObject({ message: 'db down' });
    });
  });

  describe('question pools', () => {
    it('getQuizQuestionPools returns pools for a quiz', async () => {
      const pools = [{ id: 'pool-1', quiz_id: 'quiz-1', question_count: 5 }];
      mockSupabaseClient.from().select().eq().order.mockResolvedValue({
        data: pools,
        error: null,
      });

      await expect(questionBankService.getQuizQuestionPools('quiz-1')).resolves.toEqual(pools);
    });

    it('getQuizQuestionPools returns an empty array when there are none', async () => {
      mockSupabaseClient.from().select().eq().order.mockResolvedValue({
        data: null,
        error: null,
      });

      await expect(questionBankService.getQuizQuestionPools('quiz-1')).resolves.toEqual([]);
    });

    it('getQuizQuestionPools rejects on failure', async () => {
      mockSupabaseClient.from().select().eq().order.mockResolvedValue(supabaseError('db down'));

      await expect(questionBankService.getQuizQuestionPools('quiz-1')).rejects.toMatchObject({
        message: 'db down',
      });
    });

    it('createQuestionPool inserts and returns the pool', async () => {
      const pool = { id: 'pool-1', quiz_id: 'quiz-1' };
      mockSupabaseClient.from().insert().select().single.mockResolvedValue({
        data: pool,
        error: null,
      });

      await expect(
        questionBankService.createQuestionPool({ quiz_id: 'quiz-1' } as never)
      ).resolves.toEqual(pool);
    });

    it('createQuestionPool rejects on failure', async () => {
      mockSupabaseClient.from().insert().select().single.mockResolvedValue(
        supabaseError('db down')
      );

      await expect(
        questionBankService.createQuestionPool({ quiz_id: 'quiz-1' } as never)
      ).rejects.toMatchObject({ message: 'db down' });
    });

    it('updateQuestionPool updates and returns the pool', async () => {
      const updated = { id: 'pool-1', question_count: 10 };
      mockSupabaseClient.from().update().eq().select().single.mockResolvedValue({
        data: updated,
        error: null,
      });

      await expect(
        questionBankService.updateQuestionPool('pool-1', { question_count: 10 } as never)
      ).resolves.toEqual(updated);
    });

    it('updateQuestionPool rejects on failure', async () => {
      mockSupabaseClient.from().update().eq().select().single.mockResolvedValue(
        supabaseError('db down')
      );

      await expect(
        questionBankService.updateQuestionPool('pool-1', {} as never)
      ).rejects.toMatchObject({ message: 'db down' });
    });

    it('deleteQuestionPool resolves without error', async () => {
      mockSupabaseClient.from().delete().eq.mockResolvedValue({ error: null });

      await expect(questionBankService.deleteQuestionPool('pool-1')).resolves.toBeUndefined();
    });

    it('deleteQuestionPool rejects on failure', async () => {
      mockSupabaseClient.from().delete().eq.mockResolvedValue(supabaseError('db down'));

      await expect(questionBankService.deleteQuestionPool('pool-1')).rejects.toMatchObject({
        message: 'db down',
      });
    });
  });

  describe('utilities', () => {
    it('getRandomQuestions selects ids via RPC then fetches full rows', async () => {
      const questions = [makeQuestion({ id: 'q-1' }), makeQuestion({ id: 'q-2' })];
      mockSupabaseClient.rpc.mockResolvedValue({
        data: [{ question_id: 'q-1' }, { question_id: 'q-2' }],
        error: null,
      });
      const builder = getQueryBuilder();
      builder.in.mockResolvedValue({ data: questions, error: null });

      const result = await questionBankService.getRandomQuestions('bank-1', 2);

      expect(result).toEqual(questions);
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith(
        'select_random_questions',
        expect.objectContaining({ p_bank_id: 'bank-1', p_count: 2 })
      );
      expect(builder.in).toHaveBeenCalledWith('id', ['q-1', 'q-2']);
    });

    it('getRandomQuestions rejects when the RPC fails', async () => {
      mockSupabaseClient.rpc.mockResolvedValue(supabaseError('rpc down'));

      await expect(
        questionBankService.getRandomQuestions('bank-1', 2)
      ).rejects.toMatchObject({ message: 'rpc down' });
    });

    it('getRandomQuestions rejects when the follow-up fetch fails', async () => {
      mockSupabaseClient.rpc.mockResolvedValue({
        data: [{ question_id: 'q-1' }],
        error: null,
      });
      getQueryBuilder().in.mockResolvedValue(supabaseError('db down'));

      await expect(
        questionBankService.getRandomQuestions('bank-1', 1)
      ).rejects.toMatchObject({ message: 'db down' });
    });

    it('getQuestionStatistics combines usage data with average attempt time', async () => {
      const builder = getQueryBuilder();
      builder.single.mockResolvedValue({
        data: { usage_count: 5, success_rate: 0.8 },
        error: null,
      });
      // First query's eq keeps chaining to .single(); second query's eq resolves.
      builder.eq.mockImplementationOnce(() => builder);
      builder.eq.mockResolvedValueOnce({
        data: [{ time_spent: 30 }, { time_spent: 60 }],
        error: null,
      });

      const stats = await questionBankService.getQuestionStatistics('q-1');

      expect(stats).toEqual({ usage_count: 5, success_rate: 0.8, average_time: 45 });
    });

    it('getQuestionStatistics returns zero average time with no attempts', async () => {
      const builder = getQueryBuilder();
      builder.single.mockResolvedValue({
        data: { usage_count: 0, success_rate: 0 },
        error: null,
      });
      builder.eq.mockImplementationOnce(() => builder);
      builder.eq.mockResolvedValueOnce({ data: [], error: null });

      const stats = await questionBankService.getQuestionStatistics('q-1');

      expect(stats).toEqual({ usage_count: 0, success_rate: 0, average_time: 0 });
    });

    it('getQuestionStatistics rejects when the question fetch fails', async () => {
      const builder = getQueryBuilder();
      builder.single.mockResolvedValue(supabaseError('db down'));

      await expect(questionBankService.getQuestionStatistics('q-1')).rejects.toMatchObject({
        message: 'db down',
      });
    });

    it('getQuestionStatistics rejects when the attempts fetch fails', async () => {
      const builder = getQueryBuilder();
      builder.single.mockResolvedValue({
        data: { usage_count: 5, success_rate: 0.8 },
        error: null,
      });
      builder.eq.mockImplementationOnce(() => builder);
      builder.eq.mockResolvedValueOnce(supabaseError('attempts down'));

      await expect(questionBankService.getQuestionStatistics('q-1')).rejects.toMatchObject({
        message: 'attempts down',
      });
    });
  });
});
