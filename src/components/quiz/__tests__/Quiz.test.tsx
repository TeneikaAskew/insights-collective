// ABOUTME: Tests for the career quiz question layout. The scale options used to
// ABOUTME: sit in a fixed five-column grid whose labels overflowed into each
// ABOUTME: other on phones, so each option now owns a labeled, clickable row.

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '@/test/utils/test-utils';
import Quiz from '../Quiz';
import { quizQuestions } from '@/data/careerQuizData';

const firstQuestion = quizQuestions[0];

describe('Quiz', () => {
  it('labels every scale option so the text belongs to its own radio', () => {
    render(<Quiz />);

    expect(screen.getByText(firstQuestion.text)).toBeInTheDocument();

    // The comfort scale's endpoints are the labels that overflowed the grid.
    for (const label of ['Very Uncomfortable', 'Uncomfortable', 'Neutral', 'Comfortable', 'Very Comfortable']) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
  });

  it('stacks the scale vertically until the viewport can hold five columns', () => {
    const { container } = render(<Quiz />);

    const group = container.querySelector('[role="radiogroup"]');
    expect(group).not.toBeNull();
    // Column layout is opt-in at `sm`; below that the options are flex rows.
    expect(group?.className).toContain('flex-col');
    expect(group?.className).toContain('sm:grid-cols-5');
    expect(group?.className).not.toMatch(/(^|\s)grid-cols-5/);
  });

  it('records an answer when a scale label is clicked', async () => {
    const user = userEvent.setup();
    render(<Quiz />);

    const next = screen.getByRole('button', { name: /next/i });
    expect(next).toBeDisabled();

    await user.click(screen.getByLabelText('Very Comfortable'));

    expect(screen.getByLabelText('Very Comfortable')).toBeChecked();
    expect(next).toBeEnabled();
  });
});
