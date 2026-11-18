import React from 'react';
import { expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { Gradebook } from '../Gradebook';
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));

it('edits only the assignment cell and preserves its submission identity when a quiz shares its ID', async () => {
  const id = '10000000-0000-4000-8000-000000000001';
  const onGradeUpdate = vi.fn().mockResolvedValue(undefined);
  render(<Gradebook courseId="course" students={[{ id: 's1', full_name: 'Ada', email: 'ada@example.test' }]}
    assignments={[{ id, title: 'Essay', points: 100 }] as any}
    quizzes={[{ id, title: 'Quiz', total_points: 10 }] as any} grades={[]}
    submissions={[{ id: 'assignment-sub', user_id: 's1', assignment_id: id, grade: 80, workflow_state: 'graded' }] as any}
    quizSubmissions={[{ id: 'quiz-sub', user_id: 's1', quiz_id: id, score: 6, workflow_state: 'complete' }]}
    onGradeUpdate={onGradeUpdate} onBulkGradeUpdate={vi.fn()} />);
  fireEvent.click(screen.getByText('80'));
  const input = screen.getByRole('spinbutton');
  expect(input).toHaveValue(80);
  fireEvent.change(input, { target: { value: '81' } });
  fireEvent.click(within(input.parentElement!).getByRole('button'));
  await waitFor(() => expect(onGradeUpdate).toHaveBeenCalledExactlyOnceWith({
    studentId: 's1', itemId: id, itemType: 'assignment', grade: 81, pointsPossible: 100, submissionId: 'assignment-sub',
  }));
  expect(screen.getByText('6')).toBeInTheDocument();
});
