import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@/test/utils/test-utils';
import { mockSupabaseClient } from '@/test/mocks/supabase';
import MockInterviewRoom from '@/pages/interview-prep/MockInterviewRoom';

const navigate = vi.hoisted(() => vi.fn());
// Mutable so a test can exercise /interview-prep/mock-interview-room with no
// :sessionId — App.tsx routes both that and the :sessionId form to this page.
const params = vi.hoisted(() => ({ current: { sessionId: 'session-1' } as { sessionId?: string } }));
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => navigate,
    useParams: () => params.current,
  };
});

const userState = vi.hoisted(() => ({ user: { id: 'user-1' } as null | { id: string } }));
vi.mock('@/hooks/use-user', () => ({
  useUser: () => ({ user: userState.user }),
}));

vi.mock('@/components/layout/AppLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

function mockSession(session: Record<string, unknown> | null) {
  mockSupabaseClient.from.mockImplementation(() => {
    const chain: any = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      update: vi.fn(() => chain),
      insert: vi.fn(() => chain),
      single: vi.fn(() =>
        Promise.resolve(session ? { data: session, error: null } : { data: null, error: null })
      ),
    };
    return chain;
  });
}

const BASE_SESSION = {
  id: 'session-1',
  user1_id: 'user-1',
  user2_id: 'partner-1',
  role1: 'interviewer',
  role2: 'interviewee',
  session_time: new Date(Date.now() - 60_000).toISOString(), // already started
  type: 'behavioral',
  status: 'scheduled',
  study_guide_id: null,
};

beforeEach(() => {
  navigate.mockClear();
  params.current = { sessionId: 'session-1' };
  userState.user = { id: 'user-1' };
  // jsdom has no mediaDevices; the page must handle the failure gracefully
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: vi.fn(() => Promise.reject(new Error('no cam in jsdom'))) },
  });
});

describe('MockInterviewRoom page (Side Desk)', () => {
  it('renders the interviewer room: stage, questions, and sticky evaluation form', async () => {
    mockSession(BASE_SESSION);

    render(<MockInterviewRoom />);

    expect(await screen.findByText('Behavioral Interview')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('Interviewer')).toBeInTheDocument();

    // Labeled, accessible controls
    expect(screen.getByRole('button', { name: /turn camera off/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /mute microphone/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /end session/i })).toBeInTheDocument();

    expect(screen.getByText('Interview Questions')).toBeInTheDocument();
    expect(screen.getByText('Tell me about a challenging project you worked on.')).toBeInTheDocument();

    expect(screen.getByText('Evaluation Form')).toBeInTheDocument();
    expect(screen.getByText('Communication')).toBeInTheDocument();
    expect(screen.getByText('Overall Impression')).toBeInTheDocument();
    expect(screen.getAllByText('5/10').length).toBe(4);
    expect(
      screen.getByPlaceholderText("Provide detailed feedback about the candidate's performance...")
    ).toBeInTheDocument();
  });

  it('opens the meeting link, falling back to a Jitsi room', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);

    mockSession({ ...BASE_SESSION, meeting_url: 'https://zoom.us/j/999', video_platform: 'Zoom' });
    const { unmount } = render(<MockInterviewRoom />);
    fireEvent.click(await screen.findByRole('button', { name: /join video call/i }));
    expect(open).toHaveBeenCalledWith('https://zoom.us/j/999', '_blank', 'noopener');
    unmount();

    open.mockClear();
    mockSession({ ...BASE_SESSION, meeting_url: null });
    render(<MockInterviewRoom />);
    fireEvent.click(await screen.findByRole('button', { name: /join video call/i }));
    expect(open).toHaveBeenCalledWith('https://meet.jit.si/insights-mock-session-1', '_blank', 'noopener');
    open.mockRestore();
  });

  it('hides the questions and evaluation form for the interviewee', async () => {
    mockSession({ ...BASE_SESSION, role1: 'interviewee', role2: 'interviewer' });

    render(<MockInterviewRoom />);

    expect(await screen.findByText('Behavioral Interview')).toBeInTheDocument();
    expect(screen.getByText('Interviewee')).toBeInTheDocument();
    expect(screen.queryByText('Interview Questions')).not.toBeInTheDocument();
    expect(screen.queryByText('Evaluation Form')).not.toBeInTheDocument();
  });

  it('shows a padded countdown for a future session', async () => {
    mockSession({
      ...BASE_SESSION,
      session_time: new Date(Date.now() + 5 * 60_000 + 3_000).toISOString(), // ~5m 3s out
    });

    render(<MockInterviewRoom />);

    // "5:03"-style, zero-padded — not the old unpadded "5:3"
    expect(await screen.findByText(/Starts in \d+:\d{2}$/)).toBeInTheDocument();
  });

  it('renders the not-found state when the session is missing', async () => {
    mockSession(null);

    render(<MockInterviewRoom />);

    expect(await screen.findByText('Session not found')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /return to mock interviews/i })).toBeInTheDocument();
  });

  /**
   * App.tsx routes /interview-prep/mock-interview-room here as well as the
   * :sessionId form. Without a guard the missing param went into the filter as
   * the literal string "undefined", Postgres rejected it with 22P02, and the
   * page showed "Failed to load interview session" — a database error standing
   * in for "no session was chosen".
   */
  it('redirects instead of querying when no session id is in the route', async () => {
    params.current = {};
    mockSession(BASE_SESSION);

    render(<MockInterviewRoom />);

    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith('/interview-prep/mock-interviews'));
    expect(mockSupabaseClient.from).not.toHaveBeenCalledWith('mock_sessions');
  });
});
