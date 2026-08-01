// ABOUTME: Regression test — "Saved Goals" must not appear when the write that
// ABOUTME: would save them to the user's account failed.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@/test/utils/test-utils';
import userEvent from '@testing-library/user-event';
import { mockSupabaseClient } from '@/test/mocks/supabase';
import { ResumeAnalysisOverlay } from '../ResumeAnalysisOverlay';

function mockUpdateResult(result: { error: unknown }) {
  (mockSupabaseClient.from as ReturnType<typeof vi.fn>).mockImplementation(() => {
    const builder: any = {};
    builder.update = vi.fn(() => builder);
    builder.eq = vi.fn(() => Promise.resolve(result));
    return builder;
  });
}

const props = {
  isVisible: true,
  userId: 'user-1',
  resumeId: 'resume-1',
  onComplete: vi.fn(),
};

describe('ResumeAnalysisOverlay — saving career goals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('does not claim the goals were saved when the account write failed', async () => {
    // REGRESSION: the "Saved Goals" label was driven by the localStorage write,
    // which always succeeds, so pressing Save reported success even when the
    // update below failed and the goals lived on one device only.
    mockUpdateResult({ error: { message: 'permission denied' } });

    render(<ResumeAnalysisOverlay {...(props as any)} />);

    const textarea = await screen.findByPlaceholderText(/career aspirations/i);
    await userEvent.type(textarea, 'Move into data engineering');
    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(await screen.findByText(/couldn't save to your account/i)).toBeInTheDocument();
    expect(screen.queryByText('Saved Goals')).not.toBeInTheDocument();
  });

  it('reports success when the account write succeeded', async () => {
    mockUpdateResult({ error: null });

    render(<ResumeAnalysisOverlay {...(props as any)} />);

    const textarea = await screen.findByPlaceholderText(/career aspirations/i);
    await userEvent.type(textarea, 'Move into data engineering');
    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(await screen.findByText('Saved Goals')).toBeInTheDocument();
    expect(screen.queryByText(/couldn't save to your account/i)).not.toBeInTheDocument();
  });
});
