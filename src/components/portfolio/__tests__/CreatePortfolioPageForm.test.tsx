// ABOUTME: Pins that the create form leaves the failure message to the mutation.
// ABOUTME: TOAST_LIMIT is 1, so a second toast here erases the reason the create failed.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@/test/utils/test-utils';
import userEvent from '@testing-library/user-event';
import { CreatePortfolioPageForm } from '../CreatePortfolioPageForm';

const { mockToast } = vi.hoisted(() => ({ mockToast: vi.fn() }));
vi.mock('@/hooks/use-toast', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/use-toast')>();
  return { ...actual, useToast: () => ({ toast: mockToast }) };
});

const pagesState = vi.hoisted(() => ({ add: vi.fn() }));
vi.mock('@/hooks/usePortfolioPages', () => ({
  usePortfolioPages: () => ({ addPortfolioPage: { mutateAsync: pagesState.add } }),
}));

describe('CreatePortfolioPageForm', () => {
  beforeEach(() => {
    mockToast.mockClear();
    pagesState.add.mockReset();
  });

  /**
   * `createPortfolioPage.onError` already toasts, with the specific reason —
   * "You already have a portfolio page", say. The form used to catch the same
   * rejection and toast "Failed to create portfolio page" straight after.
   * `use-toast` keeps TOAST_LIMIT = 1, so the generic one won and the reader
   * never saw the part they could act on.
   */
  it('does not toast over the mutation when creation is refused', async () => {
    pagesState.add.mockRejectedValue(
      new Error('You already have a portfolio page. Edit that one instead of creating another.')
    );
    const onSuccess = vi.fn();

    render(<CreatePortfolioPageForm onSuccess={onSuccess} />);

    await userEvent.setup().type(screen.getByLabelText(/title/i), 'Second portfolio');
    await userEvent.setup().click(screen.getByRole('button', { name: /create/i }));

    await waitFor(() => expect(pagesState.add).toHaveBeenCalled());
    expect(mockToast).not.toHaveBeenCalled();
    // The catch still has to stop the success path.
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('still reports success when the page is created', async () => {
    pagesState.add.mockResolvedValue({ id: 'page-1' });
    const onSuccess = vi.fn();

    render(<CreatePortfolioPageForm onSuccess={onSuccess} />);

    await userEvent.setup().type(screen.getByLabelText(/title/i), 'My portfolio');
    await userEvent.setup().click(screen.getByRole('button', { name: /create/i }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Success' }));
  });
});
