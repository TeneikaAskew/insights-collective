import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@/test/utils/test-utils';
import PathwayViewSwitch, {
  PATHWAY_PANEL_ID,
  PLAN_PANEL_ID,
} from '@/components/career/studio/PathwayViewSwitch';

describe('PathwayViewSwitch', () => {
  it('renders both views as tabs with the current one selected', () => {
    render(<PathwayViewSwitch value="pathway" onChange={vi.fn()} />);

    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(2);
    expect(screen.getByRole('tab', { name: /coach & pathway/i })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /action plan/i })).toHaveAttribute('aria-selected', 'false');
  });

  it('points each tab at the panel it controls', () => {
    render(<PathwayViewSwitch value="pathway" onChange={vi.fn()} />);

    expect(screen.getByTestId('pathway-view-pathway')).toHaveAttribute('aria-controls', PATHWAY_PANEL_ID);
    expect(screen.getByTestId('pathway-view-plan')).toHaveAttribute('aria-controls', PLAN_PANEL_ID);
  });

  it('reports the view that was clicked', () => {
    const onChange = vi.fn();
    render(<PathwayViewSwitch value="pathway" onChange={onChange} />);

    fireEvent.click(screen.getByTestId('pathway-view-plan'));
    expect(onChange).toHaveBeenCalledWith('plan');
  });

  it('moves between tabs with the arrow keys', () => {
    const onChange = vi.fn();
    render(<PathwayViewSwitch value="pathway" onChange={onChange} />);

    fireEvent.keyDown(screen.getByTestId('pathway-view-pathway'), { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith('plan');

    onChange.mockClear();
    fireEvent.keyDown(screen.getByTestId('pathway-view-pathway'), { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenCalledWith('plan'); // wraps around from the first tab
  });

  it('keeps only the selected tab in the tab order', () => {
    render(<PathwayViewSwitch value="plan" onChange={vi.fn()} />);

    expect(screen.getByTestId('pathway-view-plan')).toHaveAttribute('tabindex', '0');
    expect(screen.getByTestId('pathway-view-pathway')).toHaveAttribute('tabindex', '-1');
  });

  it('shows milestone progress on the plan tab', () => {
    render(<PathwayViewSwitch value="pathway" onChange={vi.fn()} milestones={{ done: 1, total: 3 }} />);

    expect(screen.getByTestId('pathway-view-plan-badge')).toHaveTextContent('1/3');
  });

  it('omits the badge when there are no milestones to count', () => {
    const { rerender } = render(<PathwayViewSwitch value="pathway" onChange={vi.fn()} milestones={null} />);
    expect(screen.queryByTestId('pathway-view-plan-badge')).not.toBeInTheDocument();

    // A plan that exists but defines no milestones must not render "0/0".
    rerender(<PathwayViewSwitch value="pathway" onChange={vi.fn()} milestones={{ done: 0, total: 0 }} />);
    expect(screen.queryByTestId('pathway-view-plan-badge')).not.toBeInTheDocument();
  });
});
