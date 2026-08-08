// ABOUTME: Tests for the home page chart showcase. The pie's callout labels ran
// ABOUTME: off the SVG on phones, so narrow viewports draw the share inside its
// ABOUTME: own slice instead; the tab labels have to stay readable there too.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { render } from '@/test/utils/test-utils';
import InteractiveShowcase from '../InteractiveShowcase';
import { renderSliceShare } from '../pieSliceLabel';

const mockUseIsMobile = vi.fn();
vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => mockUseIsMobile(),
}));

describe('renderSliceShare', () => {
  const geometry = { cx: 200, cy: 160, innerRadius: 0, outerRadius: 90 };

  it('places the label inside the slice, never past its arc', () => {
    for (const midAngle of [0, 45, 90, 180, 270, 315]) {
      const label = renderSliceShare({ ...geometry, midAngle, percent: 0.4 });
      const { x, y } = label.props;
      const distance = Math.hypot(x - geometry.cx, y - geometry.cy);

      // Anything at or beyond outerRadius is what clipped off the SVG before.
      expect(distance).toBeLessThan(geometry.outerRadius);
    }
  });

  it('renders the share as a whole percentage', () => {
    expect(renderSliceShare({ ...geometry, midAngle: 45, percent: 0.4 }).props.children).toBe('40%');
    expect(renderSliceShare({ ...geometry, midAngle: 45, percent: 0.095 }).props.children).toBe('10%');
  });
});

describe('InteractiveShowcase', () => {
  beforeEach(() => {
    mockUseIsMobile.mockReturnValue(true);
  });

  it('keeps every tab labelled rather than icon-only on phones', () => {
    render(<InteractiveShowcase />);

    for (const label of ['Skills', 'Growth', 'Roles']) {
      expect(screen.getByRole('tab', { name: label })).toBeInTheDocument();
    }
  });

  it('uses tab labels short enough that none of them truncate', () => {
    render(<InteractiveShowcase />);

    for (const label of ['Skills', 'Growth', 'Roles']) {
      // Three columns share a 448px-max list, so ~10 characters is the ceiling.
      expect(label.length).toBeLessThanOrEqual(10);
    }
  });
});
