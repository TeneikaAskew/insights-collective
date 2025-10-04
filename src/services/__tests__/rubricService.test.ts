// ABOUTME: Unit tests for Rubric Service
// ABOUTME: Tests rubric CRUD operations and assignment associations

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { rubricService } from '../rubricService';
import { mockSupabaseClient } from '@/test/mocks/supabase';

describe('rubricService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rubric CRUD', () => {
    it('should get rubrics by course', async () => {
      const mockRubrics = [
        { id: 'r1', title: 'Essay Rubric', criteria: [] },
        { id: 'r2', title: 'Project Rubric', criteria: [] }
      ];

      mockSupabaseClient.from().select().eq().order.mockResolvedValue({
        data: mockRubrics,
        error: null
      });

      const result = await rubricService.getRubricsByCourse('c1');

      expect(result).toEqual(mockRubrics);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('rubrics');
    });

    it('should get single rubric with criteria', async () => {
      const mockRubric = {
        id: 'r1',
        title: 'Essay Rubric',
        criteria: [
          { id: 'rc1', description: 'Grammar', points: 25 },
          { id: 'rc2', description: 'Content', points: 75 }
        ]
      };

      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: mockRubric,
        error: null
      });

      const result = await rubricService.getRubric('r1');

      expect(result?.criteria).toHaveLength(2);
    });

    it('should create rubric', async () => {
      const newRubric = {
        id: 'r1',
        course_id: 'c1',
        title: 'New Rubric',
        description: 'Test rubric'
      };

      mockSupabaseClient.from().insert().select().single.mockResolvedValue({
        data: newRubric,
        error: null
      });

      const result = await rubricService.createRubric({
        course_id: 'c1',
        title: 'New Rubric',
        description: 'Test rubric',
        created_by: 'u1'
      });

      expect(result.title).toBe('New Rubric');
    });

    it('should update rubric', async () => {
      const updated = { id: 'r1', title: 'Updated Rubric' };

      mockSupabaseClient.from().update().eq().select().single.mockResolvedValue({
        data: updated,
        error: null
      });

      const result = await rubricService.updateRubric('r1', {
        title: 'Updated Rubric'
      });

      expect(result.title).toBe('Updated Rubric');
    });

    it('should delete rubric', async () => {
      mockSupabaseClient.from().delete().eq.mockResolvedValue({
        error: null
      });

      await expect(
        rubricService.deleteRubric('r1')
      ).resolves.not.toThrow();
    });
  });

  describe('Rubric Criteria', () => {
    it('should create criteria', async () => {
      const criteria = {
        id: 'rc1',
        rubric_id: 'r1',
        description: 'Grammar',
        points: 25,
        order_index: 0
      };

      mockSupabaseClient.from().insert().select().single.mockResolvedValue({
        data: criteria,
        error: null
      });

      const result = await rubricService.createCriteria({
        rubric_id: 'r1',
        title: 'Grammar',
        description: 'Grammar',
        points: 25,
        order_index: 0,
        levels: []
      });

      expect(result.description).toBe('Grammar');
    });

    it('should update criteria', async () => {
      const updated = { id: 'rc1', points: 30 };

      mockSupabaseClient.from().update().eq().select().single.mockResolvedValue({
        data: updated,
        error: null
      });

      const result = await rubricService.updateCriteria('rc1', {
        points: 30
      });

      expect(result.points).toBe(30);
    });

    it('should delete criteria', async () => {
      mockSupabaseClient.from().delete().eq.mockResolvedValue({
        error: null
      });

      await expect(
        rubricService.deleteCriteria('rc1')
      ).resolves.not.toThrow();
    });

    it('should reorder criteria', async () => {
      mockSupabaseClient.from().upsert.mockResolvedValue({
        error: null
      });

      await expect(
        rubricService.reorderCriteria('r1', ['rc1', 'rc2', 'rc3'])
      ).resolves.not.toThrow();
    });
  });

  describe('Assignment Associations', () => {
    it('should attach rubric to assignment', async () => {
      mockSupabaseClient.from().insert.mockResolvedValue({
        error: null
      });

      await expect(
        rubricService.attachRubricToAssignment('a1', 'r1')
      ).resolves.not.toThrow();
    });

    it('should detach rubric from assignment', async () => {
      mockSupabaseClient.from().delete().eq().eq.mockResolvedValue({
        error: null
      });

      await expect(
        rubricService.detachRubricFromAssignment('a1', 'r1')
      ).resolves.not.toThrow();
    });

    it('should get rubrics for assignment', async () => {
      const mockData = [
        { rubric: { id: 'r1', title: 'Essay Rubric', criteria: [] } },
        { rubric: { id: 'r2', title: 'Code Rubric', criteria: [] } }
      ];

      mockSupabaseClient.from().select().eq.mockResolvedValue({
        data: mockData,
        error: null
      });

      const result = await rubricService.getRubricsForAssignment('a1');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('r1');
    });

    it('should handle missing rubrics gracefully', async () => {
      mockSupabaseClient.from().select().eq.mockResolvedValue({
        data: [],
        error: null
      });

      const result = await rubricService.getRubricsForAssignment('a1');

      expect(result).toEqual([]);
    });
  });

  describe('Error Handling', () => {
    it('should throw error on failed fetch', async () => {
      mockSupabaseClient.from().select().eq().order.mockResolvedValue({
        data: null,
        error: { message: 'Database error' }
      });

      await expect(
        rubricService.getRubricsByCourse('c1')
      ).rejects.toThrow();
    });

    it('should throw error on failed create', async () => {
      mockSupabaseClient.from().insert().select().single.mockResolvedValue({
        data: null,
        error: { message: 'Insert failed' }
      });

      await expect(
        rubricService.createRubric({
          course_id: 'c1',
          title: 'Test',
          created_by: 'u1'
        })
      ).rejects.toThrow();
    });
  });
});
