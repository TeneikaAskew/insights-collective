// ABOUTME: The course Feedback trigger sits in the top bar's slot when one is mounted (in flow, never floating over
// ABOUTME: content) and falls back to the floating pill on course pages without a top bar; name and dialog unchanged.
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CourseFeedbackButton from '@/components/course/CourseFeedbackButton';
import { FeedbackSlot, showsCourseFeedback } from '@/components/course/feedbackSlot';

vi.mock('@/contexts/AuthContext', async (orig) => ({ ...(await orig<typeof import('@/contexts/AuthContext')>()),
  useAuth: () => ({ user: { id: 'u1' }, isAuthenticated: true }) }));

const Bar = () => <header data-testid="bar"><FeedbackSlot /></header>;

describe('Course Feedback placement', () => {
  it('portals into the top bar slot: in flow, not fixed, with its accessible name and label', () => {
    render(<MemoryRouter initialEntries={['/courses/c1']}><Bar /><CourseFeedbackButton /></MemoryRouter>);
    const trigger = screen.getByRole('button', { name: 'Feedback' });
    expect(screen.getByTestId('bar').contains(trigger)).toBe(true);
    expect(trigger.className).not.toMatch(/\bfixed\b/);
    expect(trigger.textContent).toBe('Feedback');
    fireEvent.click(trigger);
    expect(screen.getByText('Send feedback or report a problem')).toBeTruthy();
  });

  it('falls back to the floating pill when the page has no top bar, and moves back when one mounts', () => {
    const { rerender } = render(<MemoryRouter initialEntries={['/courses/c1/learn']}><CourseFeedbackButton /></MemoryRouter>);
    let trigger = screen.getByRole('button', { name: 'Feedback' });
    expect(trigger.className).toMatch(/\bfixed\b/);
    act(() => { rerender(<MemoryRouter initialEntries={['/courses/c1/learn']}><Bar /><CourseFeedbackButton /></MemoryRouter>); });
    trigger = screen.getByRole('button', { name: 'Feedback' });
    expect(screen.getByTestId('bar').contains(trigger)).toBe(true);
    expect(screen.getAllByRole('button', { name: 'Feedback' })).toHaveLength(1);
  });

  it('exists only on course routes for signed-in users', () => {
    expect(showsCourseFeedback('/courses', true)).toBe(true);
    expect(showsCourseFeedback('/courses/c1/learn', true)).toBe(true);
    expect(showsCourseFeedback('/dashboard', true)).toBe(false);
    expect(showsCourseFeedback('/courses', false)).toBe(false);
  });
});
