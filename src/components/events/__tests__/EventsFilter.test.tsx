import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EventsFilter } from '../EventsFilter';
import userEvent from '@testing-library/user-event';

describe('EventsFilter', () => {
  const mockOnSearchChange = vi.fn();
  const mockOnTypeChange = vi.fn();
  const mockOnFormatChange = vi.fn();

  const defaultProps = {
    search: '',
    eventType: 'all',
    format: 'all',
    onSearchChange: mockOnSearchChange,
    onTypeChange: mockOnTypeChange,
    onFormatChange: mockOnFormatChange,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render all filter controls', () => {
    render(<EventsFilter {...defaultProps} />);

    expect(screen.getByPlaceholderText('Search events...')).toBeInTheDocument();
    expect(screen.getByText('All Types')).toBeInTheDocument();
    expect(screen.getByText('All Formats')).toBeInTheDocument();
  });

  it('should handle search input changes', async () => {
    const user = userEvent.setup();
    render(<EventsFilter {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText('Search events...');
    await user.type(searchInput, 'workshop');

    expect(mockOnSearchChange).toHaveBeenCalledTimes(8); // Called for each character
    expect(mockOnSearchChange).toHaveBeenLastCalledWith('workshop');
  });

  it('should display current search value', () => {
    render(<EventsFilter {...defaultProps} search="data science" />);

    const searchInput = screen.getByPlaceholderText('Search events...') as HTMLInputElement;
    expect(searchInput.value).toBe('data science');
  });

  it('should handle event type selection', async () => {
    const user = userEvent.setup();
    render(<EventsFilter {...defaultProps} />);

    const typeButton = screen.getByText('All Types');
    await user.click(typeButton);

    const workshopOption = screen.getByText('Workshop');
    await user.click(workshopOption);

    expect(mockOnTypeChange).toHaveBeenCalledWith('workshop');
  });

  it('should display selected event type', () => {
    render(<EventsFilter {...defaultProps} eventType="webinar" />);

    expect(screen.getByText('Webinar')).toBeInTheDocument();
  });

  it('should handle format selection', async () => {
    const user = userEvent.setup();
    render(<EventsFilter {...defaultProps} />);

    const formatButton = screen.getByText('All Formats');
    await user.click(formatButton);

    const virtualOption = screen.getByText('Virtual');
    await user.click(virtualOption);

    expect(mockOnFormatChange).toHaveBeenCalledWith('virtual');
  });

  it('should display selected format', () => {
    render(<EventsFilter {...defaultProps} format="in-person" />);

    expect(screen.getByText('In-Person')).toBeInTheDocument();
  });

  it('should show all event type options in dropdown', async () => {
    const user = userEvent.setup();
    render(<EventsFilter {...defaultProps} />);

    const typeButton = screen.getByText('All Types');
    await user.click(typeButton);

    expect(screen.getByText('All Types', { selector: '[role="option"]' })).toBeInTheDocument();
    expect(screen.getByText('Workshop')).toBeInTheDocument();
    expect(screen.getByText('Webinar')).toBeInTheDocument();
    expect(screen.getByText('Networking')).toBeInTheDocument();
    expect(screen.getByText('Hackathon')).toBeInTheDocument();
    expect(screen.getByText('Conference')).toBeInTheDocument();
    expect(screen.getByText('Other')).toBeInTheDocument();
  });

  it('should show all format options in dropdown', async () => {
    const user = userEvent.setup();
    render(<EventsFilter {...defaultProps} />);

    const formatButton = screen.getByText('All Formats');
    await user.click(formatButton);

    expect(screen.getByText('All Formats', { selector: '[role="option"]' })).toBeInTheDocument();
    expect(screen.getByText('In-Person')).toBeInTheDocument();
    expect(screen.getByText('Virtual')).toBeInTheDocument();
  });

  it('should handle clearing search input', async () => {
    const user = userEvent.setup();
    render(<EventsFilter {...defaultProps} search="test search" />);

    const searchInput = screen.getByPlaceholderText('Search events...');
    await user.clear(searchInput);

    expect(mockOnSearchChange).toHaveBeenLastCalledWith('');
  });

  it('should maintain filter selections independently', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<EventsFilter {...defaultProps} />);

    // Select event type
    const typeButton = screen.getByText('All Types');
    await user.click(typeButton);
    await user.click(screen.getByText('Workshop'));

    // Rerender with updated props
    rerender(<EventsFilter {...defaultProps} eventType="workshop" />);

    // Select format
    const formatButton = screen.getByText('All Formats');
    await user.click(formatButton);
    await user.click(screen.getByText('Virtual'));

    expect(mockOnTypeChange).toHaveBeenCalledWith('workshop');
    expect(mockOnFormatChange).toHaveBeenCalledWith('virtual');
    expect(screen.getByText('Workshop')).toBeInTheDocument();
  });

  it('should have proper accessibility attributes', () => {
    render(<EventsFilter {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText('Search events...');
    expect(searchInput).toHaveAttribute('type', 'search');
    
    const typeButton = screen.getByText('All Types');
    expect(typeButton).toHaveAttribute('role', 'combobox');
    
    const formatButton = screen.getByText('All Formats');
    expect(formatButton).toHaveAttribute('role', 'combobox');
  });
});