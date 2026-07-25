import React from 'react';
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@/test/utils/test-utils';
import { useAuth } from '@/contexts/AuthContext';
import { createMockAuthProvider } from '@/test/mocks/authMocks';
import ResumeChat from '@/components/resume/ResumeChat';
import { fixtureResumeAnalysis } from '@/test/fixtures/resumeAnalysis';

// jsdom has no scrollIntoView; the chat auto-scrolls on new messages.
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

// The welcome message only renders for a signed-in user.
beforeEach(() => {
  vi.mocked(useAuth).mockReturnValue(
    createMockAuthProvider({
      user: { id: 'test-user-id', email: 'jess@example.com' },
      isAuthenticated: true,
    }) as any
  );
});

describe('ResumeChat', () => {
  it('renders the composer with placeholder and a disabled send button', () => {
    render(<ResumeChat resumeAnalysis={fixtureResumeAnalysis} />);

    expect(
      screen.getByPlaceholderText('Ask about your resume or career path...')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send/i })).toBeDisabled();
  });

  it('greets with the analyzed grade in the welcome message', async () => {
    render(<ResumeChat resumeAnalysis={fixtureResumeAnalysis} />);

    // The welcome bubble renders markdown-formatted HTML, so the grade text
    // may be split across elements — match on the container's textContent.
    await waitFor(() => {
      const matches = screen.getAllByText(
        (_, el) => el?.textContent?.includes('82.82') ?? false,
        { selector: 'p, div' }
      );
      expect(matches.length).toBeGreaterThan(0);
    });
  });
});
