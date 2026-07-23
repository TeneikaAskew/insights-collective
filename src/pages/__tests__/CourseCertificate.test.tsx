// ABOUTME: Page tests for CourseCertificate — loading, not-completed, completed,
// ABOUTME: and RPC-error states of the completion check that gates the certificate UI.

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CourseCertificate from '@/pages/CourseCertificate';
import { mockSupabaseClient } from '@/test/mocks/supabase';
import { useAuth } from '@/contexts/AuthContext';

const COURSE_ID = 'course-1';

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useParams: () => ({ courseId: COURSE_ID }),
  };
});

// The layout drags in the sidebar, navbar, and route context — none of which
// this page's states depend on.
vi.mock('@/components/course/CourseLayout', () => ({
  CourseLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="course-layout">{children}</div>
  ),
}));

// The certification widget has its own tests (see VerifyCertificate.test.tsx);
// here we only care that the page mounts it with the right mode.
vi.mock('@/components/certification/CertificationSystem', () => ({
  default: (props: { mode: string }) => (
    <div data-testid="certification-system">mode:{props.mode}</div>
  ),
}));

const authedUser = {
  id: 'user-1',
  email: 'ada@example.com',
  user_metadata: { full_name: 'Ada Lovelace' },
};

function makeAuthValue(user: unknown) {
  return {
    user,
    session: null,
    loading: false,
    error: null,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    googleSignIn: vi.fn(),
    githubSignIn: vi.fn(),
    twitterSignIn: vi.fn(),
    isAuthenticated: !!user,
    isAdmin: false,
    isAdminAuthenticated: false,
    storeRedirectPath: vi.fn(),
    handleRedirectAfterLogin: vi.fn(),
  } as any;
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <CourseCertificate />
    </QueryClientProvider>
  );
}

const rpcMock = mockSupabaseClient.rpc as ReturnType<typeof vi.fn>;

describe('CourseCertificate page', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue(makeAuthValue(authedUser));
    rpcMock.mockReset();
  });

  it('shows a loading skeleton while the completion check is in flight', () => {
    rpcMock.mockReturnValue(new Promise(() => {})); // never settles

    const { container } = renderPage();

    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
    expect(screen.queryByText('Your certificate is ready')).not.toBeInTheDocument();
    expect(screen.queryByText('Course certificate')).not.toBeInTheDocument();
  });

  it('asks the user to log in when unauthenticated', () => {
    vi.mocked(useAuth).mockReturnValue(makeAuthValue(null));
    rpcMock.mockResolvedValue({ data: null, error: null });

    renderPage();

    expect(screen.getByText(/please log in to view your certificate/i)).toBeInTheDocument();
    expect(screen.queryByTestId('certification-system')).not.toBeInTheDocument();
  });

  it('shows the not-completed state when the RPC says the course is incomplete', async () => {
    rpcMock.mockResolvedValue({ data: false, error: null });

    renderPage();

    expect(await screen.findByText('Course certificate')).toBeInTheDocument();
    expect(
      screen.getByText(/you must complete all course requirements/i)
    ).toBeInTheDocument();
    expect(screen.queryByText('Your certificate is ready')).not.toBeInTheDocument();
    // The certification widget is still mounted (in issue mode) so the user
    // sees their progress toward the certificate.
    expect(screen.getByTestId('certification-system')).toHaveTextContent('mode:issue');
    expect(rpcMock).toHaveBeenCalledWith('check_course_completion', {
      p_course_id: COURSE_ID,
      p_student_id: authedUser.id,
    });
  });

  it('shows the ready state and renders CertificationSystem when completed', async () => {
    rpcMock.mockResolvedValue({ data: true, error: null });

    renderPage();

    expect(await screen.findByText('Your certificate is ready')).toBeInTheDocument();
    expect(screen.getByText(/download, share, or verify/i)).toBeInTheDocument();
    expect(
      screen.queryByText(/you must complete all course requirements/i)
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('certification-system')).toHaveTextContent('mode:issue');
  });

  it('REGRESSION: an RPC error must not be presented as a completed course', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: 'connection refused', code: 'PGRST000', details: '', hint: '' },
    });

    renderPage();

    // The query rejects (the page throws on RPC error), so loading must end...
    await waitFor(() =>
      expect(screen.queryByText('Achievement unlocked')).toBeInTheDocument()
    );
    // ...and under no circumstances may a failed completion check claim the
    // certificate is ready.
    expect(screen.queryByText('Your certificate is ready')).not.toBeInTheDocument();
    expect(screen.queryByText(/download, share, or verify/i)).not.toBeInTheDocument();
    // The page falls back to the neutral, non-completed framing.
    expect(screen.getByText('Course certificate')).toBeInTheDocument();
  });
});
