// ABOUTME: Tests for the home page chart showcase. The charts carry sourced
// ABOUTME: figures rather than invented ones, so each tab has to name and link
// ABOUTME: its source, and the tab labels have to stay readable on a phone.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '@/test/utils/test-utils';
import InteractiveShowcase from '../InteractiveShowcase';

const mockUseIsMobile = vi.fn();
vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => mockUseIsMobile(),
}));

describe('InteractiveShowcase', () => {
  beforeEach(() => {
    mockUseIsMobile.mockReturnValue(true);
  });

  it('keeps every tab labelled rather than icon-only on phones', () => {
    render(<InteractiveShowcase />);

    for (const label of ['Skills', 'Growth', 'Pay']) {
      expect(screen.getByRole('tab', { name: label })).toBeInTheDocument();
    }
  });

  it('credits the skills figures to the study they come from', () => {
    render(<InteractiveShowcase />);

    expect(screen.getByText(/1,355 US data analyst postings/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /365 Data Science/ })).toHaveAttribute(
      'href',
      'https://365datascience.com/career-advice/data-analyst-job-outlook-2025/',
    );
  });

  it('credits the wage figures to BLS and dates them', async () => {
    const user = userEvent.setup();
    render(<InteractiveShowcase />);

    await user.click(screen.getByRole('tab', { name: 'Pay' }));

    expect(screen.getByText(/Median annual wage in the US/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /May 2025/ })).toHaveAttribute(
      'href',
      'https://www.bls.gov/news.release/ocwage.t01.htm',
    );
  });

  it('still marks the growth chart as sample data, since it is not sourced', async () => {
    const user = userEvent.setup();
    render(<InteractiveShowcase />);

    await user.click(screen.getByRole('tab', { name: 'Growth' }));

    expect(screen.getByText(/Illustrative sample data/)).toBeInTheDocument();
  });
});
