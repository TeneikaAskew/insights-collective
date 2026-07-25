import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test/utils/test-utils';
import CodePractice from '@/pages/interview-prep/CodePractice';

const navigate = vi.hoisted(() => vi.fn());
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => navigate,
  };
});

vi.mock('@/components/layout/AppLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// Monaco loads its editor over the network; stub it with a plain textarea
const editorOnChange = vi.hoisted(() => ({ current: null as null | ((v: string) => void) }));
vi.mock('@monaco-editor/react', () => ({
  default: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => {
    editorOnChange.current = onChange;
    return <textarea aria-label="code editor" value={value} readOnly />;
  },
}));

beforeEach(() => {
  navigate.mockClear();
  vi.useRealTimers();
});

describe('CodePractice page (Problem Book)', () => {
  it('renders the original heading, role selector, and default challenge', () => {
    render(<CodePractice />);

    expect(screen.getByText('Code Challenge Practice')).toBeInTheDocument();
    expect(screen.getByText('Practice technical coding challenges with real-time feedback.')).toBeInTheDocument();
    expect(screen.getByText('Select your target role:')).toBeInTheDocument();

    // Default role is All Roles -> Two Sum, JavaScript
    expect(screen.getByText('Two Sum')).toBeInTheDocument();
    expect(screen.getByText('Easy')).toBeInTheDocument();
    expect(screen.getByText('JavaScript')).toBeInTheDocument();
    expect(screen.getByText('Example')).toBeInTheDocument();
    expect(screen.getByText('Constraints')).toBeInTheDocument();
    expect(screen.getByText('Hints')).toBeInTheDocument();
    expect(screen.getByText(/Hint 1\./)).toBeInTheDocument();
  });

  it('shows the editor chrome with a gated feedback tab', () => {
    render(<CodePractice />);

    // Default role (All Roles) is a JavaScript challenge
    expect(screen.getByText('solution.js')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Code Editor' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Feedback' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /submit solution/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /reset/i })).toBeInTheDocument();
  });

  it('navigates back to the interview prep hub', () => {
    render(<CodePractice />);
    fireEvent.click(screen.getByRole('button', { name: /interview prep/i }));
    expect(navigate).toHaveBeenCalledWith('/interview-prep');
  });

  it('replaces the problem page with the result card after submitting', async () => {
    render(<CodePractice />);

    fireEvent.click(screen.getByRole('button', { name: /submit solution/i }));

    // Simulated evaluation resolves after 1.5s
    expect(await screen.findByText('Result', {}, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.getByText('Correct')).toBeInTheDocument();
    expect(screen.getByText('42ms')).toBeInTheDocument();
    expect(screen.getByText('8.2MB')).toBeInTheDocument();
    expect(screen.getByText('3/3')).toBeInTheDocument();
    expect(screen.getByText('test cases passed')).toBeInTheDocument();
    expect(screen.getByText('Code Review')).toBeInTheDocument();
    expect(screen.getByText(/your solution for the two sum challenge/i)).toBeInTheDocument();
    expect(screen.getByText('Suggestions')).toBeInTheDocument();
    expect(screen.getByText(/for all roles roles, consider focusing on performance/i)).toBeInTheDocument();

    // Problem page is swapped out while viewing feedback
    expect(screen.queryByText('Constraints')).not.toBeInTheDocument();

    // Continue Editing flips back to the problem page
    fireEvent.click(screen.getByRole('button', { name: /continue editing/i }));
    await waitFor(() => {
      expect(screen.getByText('Constraints')).toBeInTheDocument();
    });
    // Feedback stays reachable from the editor chrome
    expect(screen.getByRole('tab', { name: 'Feedback' })).toBeEnabled();
  });
});
