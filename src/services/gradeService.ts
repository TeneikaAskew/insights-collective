// IMPORTANT: The `grades` table is absent from the generated Supabase schema
// (see src/integrations/supabase/types.ts). Every function in this service
// will throw at runtime until a migration adds the table. Callers must
// surface these errors to the user — do NOT catch and swallow them into
// fake-success defaults.
import { supabase } from '@/integrations/supabase/client';
import { Grade } from '@/types/course';

export const gradeService = {
  // Get all grades for a course
  async getGradesByCourse(courseId: string) {
    const { data, error } = await supabase
      .from('grades')
      .select(`
        *,
        student:profiles!student_id(
          id,
          first_name,
          last_name,
          avatar_url
        ),
        assignment:assignments(
          id,
          title,
          points,
          module_id
        ),
        quiz:quizzes(
          id,
          title,
          points_possible,
          module_id
        )
      `)
      .eq('course_id', courseId);
    
    if (error) throw error;
    return data;
  },

  // Get grades for a specific student in a course
  async getStudentGrades(courseId: string, studentId: string) {
    const { data, error } = await supabase
      .from('grades')
      .select(`
        *,
        assignment:assignments(
          id,
          title,
          points,
          due_date,
          module:modules(id, title)
        ),
        quiz:quizzes(
          id,
          title,
          points_possible,
          module:modules(id, title)
        )
      `)
      .eq('course_id', courseId)
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  // Create or update a grade
  async upsertGrade(grade: Partial<Grade>) {
    const { data, error } = await supabase
      .from('grades')
      .upsert(grade as any, {
        onConflict: 'course_id,student_id,assignment_id,quiz_id'
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Bulk update grades
  async bulkUpdateGrades(grades: Partial<Grade>[]) {
    const { data, error } = await supabase
      .from('grades')
      .upsert(grades as any, {
        onConflict: 'course_id,student_id,assignment_id,quiz_id'
      })
      .select();
    
    if (error) throw error;
    return data;
  },

  // Calculate course grade for a student
  async calculateCourseGrade(courseId: string, studentId: string) {
    const { data: grades, error } = await supabase
      .from('grades')
      .select('*')
      .eq('course_id', courseId)
      .eq('student_id', studentId);
    
    if (error) throw error;

    // Calculate weighted average alongside raw point totals
    let totalEarned = 0;
    let totalPossible = 0;
    let weightedScore = 0;
    let totalWeight = 0;

    grades?.forEach(grade => {
      if (
        grade.points_earned !== null &&
        grade.points_possible !== null &&
        grade.points_possible > 0
      ) {
        const weight = grade.weight || 1;
        totalEarned += grade.points_earned;
        totalPossible += grade.points_possible;
        weightedScore += (grade.points_earned / grade.points_possible) * weight;
        totalWeight += weight;
      }
    });

    const percentage = totalWeight > 0 ? (weightedScore / totalWeight) * 100 : 0;
    
    return {
      percentage,
      letterGrade: this.getLetterGrade(percentage),
      totalEarned,
      totalPossible,
    };
  },

  // Get letter grade from percentage
  getLetterGrade(percentage: number): string {
    if (percentage >= 90) return 'A';
    if (percentage >= 80) return 'B';
    if (percentage >= 70) return 'C';
    if (percentage >= 60) return 'D';
    return 'F';
  },

  // Export grades to CSV
  async exportGradesToCSV(courseId: string) {
    const { data: grades, error } = await supabase
      .from('grades')
      .select(`
        *,
        student:profiles!student_id(
          first_name,
          last_name
        ),
        assignment:assignments(title),
        quiz:quizzes(title)
      `)
      .eq('course_id', courseId);

    if (error) throw error;

    // Convert to CSV format
    const headers = ['Student Name', 'Assignment/Quiz', 'Type', 'Points Earned', 'Points Possible', 'Percentage', 'Letter Grade'];
    const rows = grades?.map(grade => [
      `${grade.student.first_name ?? ''} ${grade.student.last_name ?? ''}`.trim(),
      grade.assignment?.title || grade.quiz?.title || '',
      grade.grade_type,
      grade.points_earned || '',
      grade.points_possible || '',
      grade.percentage || '',
      grade.letter_grade || ''
    ]);

    const csv = [
      headers.join(','),
      ...(rows?.map(row => row.join(',')) || [])
    ].join('\n');

    return csv;
  },

  // Import grades from CSV
  // Not implemented: the previous version parsed the CSV but mapped none of the
  // row values (no student, no points), then "succeeded" by upserting empty
  // rows into a table that does not exist. Throw instead of fake-succeeding.
  async importGradesFromCSV(_courseId: string, _csvData: string, _graderId: string): Promise<never> {
    throw new Error(
      'Grade CSV import is not available: the grades table does not exist in the current schema'
    );
  },

  // Get grade statistics for a course
  async getCourseStatistics(courseId: string) {
    const { data: grades, error } = await supabase
      .from('grades')
      .select('percentage')
      .eq('course_id', courseId)
      .not('percentage', 'is', null);
    
    if (error) throw error;

    if (!grades || grades.length === 0) {
      return {
        average: 0,
        median: 0,
        highest: 0,
        lowest: 0,
        standardDeviation: 0,
      };
    }

    const percentages = grades.map(g => g.percentage!).sort((a, b) => a - b);
    const sum = percentages.reduce((acc, val) => acc + val, 0);
    const average = sum / percentages.length;
    
    // Calculate median
    const median = percentages.length % 2 === 0
      ? (percentages[percentages.length / 2 - 1] + percentages[percentages.length / 2]) / 2
      : percentages[Math.floor(percentages.length / 2)];
    
    // Calculate standard deviation
    const squaredDiffs = percentages.map(p => Math.pow(p - average, 2));
    const avgSquaredDiff = squaredDiffs.reduce((acc, val) => acc + val, 0) / percentages.length;
    const standardDeviation = Math.sqrt(avgSquaredDiff);

    return {
      average,
      median,
      highest: percentages[percentages.length - 1],
      lowest: percentages[0],
      standardDeviation,
    };
  },
};

export default gradeService;