import { supabase } from '@/integrations/supabase/client';
import { Rubric, RubricCriteria } from '@/types/course';

export const rubricService = {
  // Get all rubrics for a course
  async getRubricsByCourse(courseId: string): Promise<Rubric[]> {
    const { data, error } = await supabase
      .from('rubrics')
      .select(`
        *,
        criteria:rubric_criteria(*)
      `)
      .eq('course_id', courseId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as unknown as Rubric[];
  },

  // Get a single rubric with criteria
  async getRubric(rubricId: string): Promise<Rubric | null> {
    const { data, error } = await supabase
      .from('rubrics')
      .select(`
        *,
        criteria:rubric_criteria(*)
      `)
      .eq('id', rubricId)
      .single();

    if (error) throw error;
    return data as unknown as Rubric;
  },

  // Create a new rubric
  async createRubric(rubric: Omit<Rubric, 'id' | 'created_at' | 'updated_at'>): Promise<Rubric> {
    const { data, error } = await supabase
      .from('rubrics')
      .insert(rubric as any)
      .select()
      .single();

    if (error) throw error;
    return data as unknown as Rubric;
  },

  // Update a rubric
  async updateRubric(rubricId: string, updates: Partial<Rubric>): Promise<Rubric> {
    const { data, error } = await supabase
      .from('rubrics')
      .update(updates as any)
      .eq('id', rubricId)
      .select()
      .single();

    if (error) throw error;
    return data as unknown as Rubric;
  },

  // Delete a rubric
  async deleteRubric(rubricId: string): Promise<void> {
    const { error } = await supabase
      .from('rubrics')
      .delete()
      .eq('id', rubricId);

    if (error) throw error;
  },

  // Create rubric criteria
  async createCriteria(criteria: Omit<RubricCriteria, 'id' | 'created_at'>): Promise<RubricCriteria> {
    const { data, error } = await supabase
      .from('rubric_criteria')
      .insert(criteria as any)
      .select()
      .single();

    if (error) throw error;
    return data as unknown as RubricCriteria;
  },

  // Update rubric criteria
  async updateCriteria(criteriaId: string, updates: Partial<RubricCriteria>): Promise<RubricCriteria> {
    const { data, error } = await supabase
      .from('rubric_criteria')
      .update(updates as any)
      .eq('id', criteriaId)
      .select()
      .single();

    if (error) throw error;
    return data as unknown as RubricCriteria;
  },

  // Delete rubric criteria
  async deleteCriteria(criteriaId: string): Promise<void> {
    const { error } = await supabase
      .from('rubric_criteria')
      .delete()
      .eq('id', criteriaId);

    if (error) throw error;
  },

  // Reorder criteria
  async reorderCriteria(rubricId: string, criteriaIds: string[]): Promise<void> {
    const updates = criteriaIds.map((id, index) => ({
      id,
      order_index: index
    }));

    const { error } = await supabase
      .from('rubric_criteria')
      .upsert(updates as any);

    if (error) throw error;
  },

  // Attach rubric to assignment
  async attachRubricToAssignment(assignmentId: string, rubricId: string): Promise<void> {
    const { error } = await supabase
      .from('assignment_rubrics')
      .insert({ assignment_id: assignmentId, rubric_id: rubricId });

    if (error) throw error;
  },

  // Detach rubric from assignment
  async detachRubricFromAssignment(assignmentId: string, rubricId: string): Promise<void> {
    const { error } = await supabase
      .from('assignment_rubrics')
      .delete()
      .eq('assignment_id', assignmentId)
      .eq('rubric_id', rubricId);

    if (error) throw error;
  },

  // Get rubrics for an assignment
  async getRubricsForAssignment(assignmentId: string): Promise<Rubric[]> {
    const { data, error } = await supabase
      .from('assignment_rubrics')
      .select(`
        rubric:rubrics(
          *,
          criteria:rubric_criteria(*)
        )
      `)
      .eq('assignment_id', assignmentId);

    if (error) throw error;
    return (data?.map((item: any) => item.rubric).filter(Boolean) || []) as unknown as Rubric[];
  }
};