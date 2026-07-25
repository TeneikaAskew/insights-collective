import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test/utils/test-utils';
import { mockSupabaseClient } from '@/test/mocks/supabase';
import MockInterviews from '@/pages/interview-prep/MockInterviews';

const navigate = vi.hoisted(() => vi.fn());
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => navigate,
  };
});

const userState = vi.hoisted(() => ({ user: null as null | { id: string } }));
vi.mock('@/hooks/use-user', () => ({
  useUser: () => ({ user: userState.user }),
}));

vi.mock('@/components/layout/AppLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// AvailabilityManager has its own data lifecycle; keep it out of page tests
vi.mock('@/components/interview-prep/AvailabilityManager', () => ({
  AvailabilityManager: () => <div>availability-manager</div>,
}));

const SESSIONS = [
  {
    id: 's1',
    user1_id: 'user-1',
    user2_id: 'partner-1',
    role1: 'interviewer',
    role2: 'interviewee',
    session_time: new Date(Date.now() + 86_400_000).toISOString(), // tomorrow
    end_time: new Date(Date.now() + 90_000_000).toISOString(),
    type: 'behavioral',
    status: 'scheduled',
    study_guide_id: null,
    video_platform: 'Google Meet',
  },
  {
    id: 's2',
    user1_id: 'user-1',
    user2_id: 'partner-2',
    role1: 'interviewee',
    role2: 'interviewer',
    session_time: new Date(Date.now() - 86_400_000).toISOString(), // yesterday
    end_time: new Date(Date.now() - 82_800_000).toISOString(),
    type: 'technical',
    status: 'completed',
    study_guide_id: null,
    video_platform: 'Google Meet',
  },
];

function mockQueries({ sessions = SESSIONS, availability = [{ id: 'a1' }] } = {}) {
  mockSupabaseClient.from.mockImplementation((table: string) => {
    const chain: any = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => {
        if (table === 'availability_slots') {
          return Promise.resolve({ data: availability, error: null });
        }
        return chain;
      }),
      or: vi.fn(() => chain),
      order: vi.fn(() => Promise.resolve({ data: sessions, error: null })),
      in: vi.fn(() => chain),
      neq: vi.fn(() => Promise.resolve({ data: [], error: null })),
      insert: vi.fn(() => chain),
      single: vi.fn(() => Promise.resolve({ data: null, error: null })),
    };
    return chain;
  });
}

beforeEach(() => {
  navigate.mockClear();
  userState.user = null;
});

// Radix tab triggers activate on mousedown, not click
const clickTab = (el: HTMLElement) => fireEvent.mouseDown(el, { button: 0 });

describe('MockInterviews page (Split Desk)', () => {
  it('renders (not an infinite spinner) when logged out', async () => {
    render(<MockInterviews />);

    expect(await screen.findByText('Mock Interviews')).toBeInTheDocument();
    expect(screen.getByText('Schedule and participate in mock interviews with peers.')).toBeInTheDocument();
    expect(document.querySelector('.animate-spin')).toBeNull();
  });

  it('shows the four pill tabs and the split-desk find layout', async () => {
    userState.user = { id: 'user-1' };
    mockQueries();

    render(<MockInterviews />);

    expect(await screen.findByRole('tab', { name: 'Find Sessions' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Set Availability' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Upcoming Sessions' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /guidelines/i })).toBeInTheDocument();

    expect(screen.getByText('Find Available Partners')).toBeInTheDocument();
    expect(screen.getByText('Select Date')).toBeInTheDocument();
    // Right pane placeholder until a date is chosen
    expect(screen.getByText('Please select a date first')).toBeInTheDocument();
    // Upcoming card is on the find tab too, filtered to scheduled sessions
    expect(screen.getByText('Behavioral')).toBeInTheDocument();
    expect(screen.getByText('Scheduled')).toBeInTheDocument();
    expect(screen.getByText('You are the Interviewer')).toBeInTheDocument();
  });

  it('shows the availability banner when no availability rows exist', async () => {
    userState.user = { id: 'user-1' };
    mockQueries({ availability: [] });

    render(<MockInterviews />);

    expect(
      await screen.findByText('Please set your availability first to help others find matching times.')
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Set Availability' }));
    await waitFor(() => {
      expect(screen.getByText('availability-manager')).toBeInTheDocument();
    });
  });

  it('splits upcoming and past sessions in the Upcoming tab', async () => {
    userState.user = { id: 'user-1' };
    mockQueries();

    render(<MockInterviews />);
    await screen.findByText('Find Available Partners');

    clickTab(screen.getByRole('tab', { name: 'Upcoming Sessions' }));

    expect(await screen.findByText('Past sessions')).toBeInTheDocument();
    expect(screen.getByText('Technical')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('You are the Interviewee')).toBeInTheDocument();
    // Only the scheduled future session gets a join button
    expect(screen.getAllByRole('button', { name: /join session/i }).length).toBe(1);
  });

  it('navigates back to the interview prep hub', async () => {
    userState.user = { id: 'user-1' };
    mockQueries();

    render(<MockInterviews />);
    fireEvent.click(await screen.findByRole('button', { name: /interview prep/i }));
    expect(navigate).toHaveBeenCalledWith('/interview-prep');
  });

  it('keeps the full guidelines content', async () => {
    userState.user = { id: 'user-1' };
    mockQueries();

    render(<MockInterviews />);
    await screen.findByText('Find Available Partners');

    clickTab(screen.getByRole('tab', { name: /guidelines/i }));

    expect(await screen.findByText('Interview Guidelines')).toBeInTheDocument();
    expect(screen.getByText('Purpose & Benefits')).toBeInTheDocument();
    expect(screen.getByText('Why Mock Interviews Matter')).toBeInTheDocument();
    expect(screen.getByText('Giving Feedback')).toBeInTheDocument();
    expect(screen.getByText('Final Reminders')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'StrataScratch' })).toHaveAttribute(
      'href',
      'https://www.stratascratch.com/'
    );
  });
});
