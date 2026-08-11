// ABOUTME: Unit tests for the Quiz Service
// ABOUTME: Covers quiz attempt storage and career coach conversation startup

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { storeQuizAttempt, startCareerCoachConversation } from '../quizService';
import { mockSupabaseClient, supabaseError, getQueryBuilder } from '@/test/mocks/supabase';
import { EmptyResultError } from '@/lib/resultIntegrity';
import type { CareerTrack } from '@/data/careerQuizData';

const scores: Record<CareerTrack, number> = {
  'AI/ML': 10,
  'Analytics': 25,
  'Data Engineering': 5,
  'Business Intelligence': 15,
} as Record<CareerTrack, number>;

const answers: Record<number, number | string> = {
  1: 4,
  2: 3,
  10: 'python',
};

// Builds a standalone chainable query builder for multi-table tests where
// `from` is re-routed per table via from.mockImplementation((table) => builder).
function makeBuilder() {
  const builder: any = {};
  for (const key of ['select', 'insert', 'update', 'delete', 'upsert', 'eq', 'in', 'order', 'limit']) {
    builder[key] = vi.fn().mockReturnValue(builder);
  }
  builder.single = vi.fn().mockResolvedValue({ data: null, error: null });
  builder.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  return builder;
}

function routeTables(builders: Record<string, any>) {
  (mockSupabaseClient.from as ReturnType<typeof vi.fn>).mockImplementation(
    (table: string) => {
      if (!builders[table]) {
        throw new Error(`Unexpected table queried in test: ${table}`);
      }
      return builders[table];
    }
  );
  return builders;
}

describe('quizService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (mockSupabaseClient.auth.getUser as any).mockResolvedValue({
      data: { user: null },
      error: null,
    });
    (mockSupabaseClient.rpc as any).mockResolvedValue({ data: null, error: null });
  });

  describe('storeQuizAttempt', () => {
    it('should insert the attempt and return its id', async () => {
      mockSupabaseClient.from().insert().select().single.mockResolvedValue({
        data: { id: 'attempt-1' },
        error: null,
      });

      const result = await storeQuizAttempt(answers, scores);

      expect(result).toBe('attempt-1');
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('career_quiz_attempts');
      expect(getQueryBuilder().insert).toHaveBeenCalledWith(
        expect.objectContaining({
          result_ai_ml_score: 10,
          result_analytics_score: 25,
          result_data_engineering_score: 5,
          result_business_intelligence_score: 15,
          top_recommended_path: 'Analytics',
          q1_coding_comfort: 4,
          q2_stat_modeling_interest: 3,
          q10_tool_choice: 'python',
        })
      );
      // Anonymous user: no user_id attached
      expect(getQueryBuilder().insert).not.toHaveBeenCalledWith(
        expect.objectContaining({ user_id: expect.anything() })
      );
    });

    it('should attach the user id when authenticated', async () => {
      (mockSupabaseClient.auth.getUser as any).mockResolvedValue({
        data: { user: { id: 'user-42' } },
        error: null,
      });
      mockSupabaseClient.from().insert().select().single.mockResolvedValue({
        data: { id: 'attempt-2' },
        error: null,
      });

      const result = await storeQuizAttempt(answers, scores);

      expect(result).toBe('attempt-2');
      expect(getQueryBuilder().insert).toHaveBeenCalledWith(
        expect.objectContaining({ user_id: 'user-42' })
      );
    });

    it('should REJECT when the insert fails, not return null', async () => {
      mockSupabaseClient.from().insert().select().single.mockResolvedValue(
        supabaseError('insert failed')
      );

      await expect(storeQuizAttempt(answers, scores)).rejects.toThrow();
    });

    it('should REFUSE to store an attempt where every track scored zero', async () => {
      // Callers that had no scores to hand over used to write this row anyway.
      // It sorted newest by created_at, so it outranked the account's real
      // attempts and the profile reported a 0% match for every track.
      const emptyScores = {
        'AI/ML': 0,
        'Analytics': 0,
        'Data Engineering': 0,
        'Business Intelligence': 0,
      } as Record<CareerTrack, number>;

      await expect(storeQuizAttempt(answers, emptyScores)).rejects.toThrow(
        /empty quiz attempt.*every track scored 0/i,
      );
      await expect(storeQuizAttempt(answers, emptyScores)).rejects.toThrow(EmptyResultError);
      expect(getQueryBuilder().insert).not.toHaveBeenCalled();
    });

    it('should still store an attempt where only one track scored', async () => {
      mockSupabaseClient.from().insert().select().single.mockResolvedValue({
        data: { id: 'attempt-3' },
        error: null,
      });

      const oneTrack = {
        'AI/ML': 0,
        'Analytics': 0,
        'Data Engineering': 4,
        'Business Intelligence': 0,
      } as Record<CareerTrack, number>;

      await expect(storeQuizAttempt(answers, oneTrack)).resolves.toBe('attempt-3');
    });
  });

  describe('startCareerCoachConversation', () => {
    it('should create a conversation, store the RPC-generated greeting, and return the id', async () => {
      const conversationBuilder = makeBuilder();
      conversationBuilder.single.mockResolvedValue({
        data: { id: 'conv-1' },
        error: null,
      });

      const messagesBuilder = makeBuilder();
      messagesBuilder.insert.mockResolvedValue({ error: null });

      routeTables({
        assistant_conversations: conversationBuilder,
        assistant_messages: messagesBuilder,
      });

      (mockSupabaseClient.rpc as any).mockResolvedValue({
        data: 'Welcome back, future analyst!',
        error: null,
      });

      const result = await startCareerCoachConversation('attempt-1');

      expect(result).toBe('conv-1');
      expect(conversationBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({ quiz_attempt_id: 'attempt-1', is_active: true })
      );
      expect(messagesBuilder.insert).toHaveBeenCalledWith({
        conversation_id: 'conv-1',
        sender_type: 'assistant',
        content: 'Welcome back, future analyst!',
      });
    });

    it('should fall back to the default greeting when the RPC returns nothing', async () => {
      const conversationBuilder = makeBuilder();
      conversationBuilder.single.mockResolvedValue({
        data: { id: 'conv-2' },
        error: null,
      });

      const messagesBuilder = makeBuilder();
      messagesBuilder.insert.mockResolvedValue({ error: null });

      routeTables({
        assistant_conversations: conversationBuilder,
        assistant_messages: messagesBuilder,
      });

      (mockSupabaseClient.rpc as any).mockResolvedValue({ data: null, error: null });

      const result = await startCareerCoachConversation('attempt-1');

      expect(result).toBe('conv-2');
      expect(messagesBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining("Hello! I'm your Career Coach Assistant"),
        })
      );
    });

    it('should fall back to the default greeting when the RPC errors', async () => {
      const conversationBuilder = makeBuilder();
      conversationBuilder.single.mockResolvedValue({
        data: { id: 'conv-3' },
        error: null,
      });

      const messagesBuilder = makeBuilder();
      messagesBuilder.insert.mockResolvedValue({ error: null });

      routeTables({
        assistant_conversations: conversationBuilder,
        assistant_messages: messagesBuilder,
      });

      (mockSupabaseClient.rpc as any).mockResolvedValue({
        data: null,
        error: { message: 'function does not exist' },
      });

      const result = await startCareerCoachConversation('attempt-1');

      expect(result).toBe('conv-3');
      expect(messagesBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining("Hello! I'm your Career Coach Assistant"),
        })
      );
    });

    it('should REJECT when creating the conversation fails', async () => {
      const conversationBuilder = makeBuilder();
      conversationBuilder.single.mockResolvedValue(supabaseError('conversation insert failed'));

      routeTables({ assistant_conversations: conversationBuilder });

      await expect(startCareerCoachConversation('attempt-1')).rejects.toThrow();
    });

    it('should REJECT with a descriptive error when storing the initial message fails', async () => {
      const conversationBuilder = makeBuilder();
      conversationBuilder.single.mockResolvedValue({
        data: { id: 'conv-4' },
        error: null,
      });

      const messagesBuilder = makeBuilder();
      messagesBuilder.insert.mockResolvedValue({
        error: { message: 'insert into assistant_messages failed' },
      });

      routeTables({
        assistant_conversations: conversationBuilder,
        assistant_messages: messagesBuilder,
      });

      await expect(startCareerCoachConversation('attempt-1')).rejects.toThrow(
        /Conversation conv-4 was created, but storing the initial assistant message failed/
      );
    });
  });
});
