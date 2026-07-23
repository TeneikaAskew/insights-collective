// ABOUTME: Tests for the public certificate verification flow — the VerifyCertificate
// ABOUTME: page states, plus the fixed CertificationSystem verify mode where a DB
// ABOUTME: failure must render "Verification failed" + Retry, never "Invalid verification code".

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import VerifyCertificate from '@/pages/VerifyCertificate';
import CertificationSystem from '@/components/certification/CertificationSystem';
import { mockSupabaseClient } from '@/test/mocks/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { makeCourse, makeCertificate } from '@/test/utils/course-fixtures';

const CODE = 'CERTABCD1234';

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useParams: () => ({ code: CODE }),
  };
});

// CertificationSystem pulls in progress tracking, which fires its own course
// queries. Verify mode never uses courseProgress, so keep the hook inert.
vi.mock('@/hooks/useProgressTracking', () => ({
  useProgressTracking: () => ({
    courseProgress: null,
    moduleProgress: null,
    contentProgress: [],
    loading: false,
    error: null,
  }),
}));

const fetchMock = global.fetch as ReturnType<typeof vi.fn>;

function jsonResponse(status: number, body: unknown) {
  return { status, json: async () => body } as unknown as Response;
}

const verifiedCertificate = {
  verification_code: CODE,
  certificate_type: 'completion',
  issued_at: '2026-02-01T00:00:00Z',
  certificate_data: { completion_percentage: 100 },
  course_id: 'course-1',
  course_title: 'Intro to Data Analytics',
  course_category: 'Data',
  course_level: 'Beginner',
  course_duration: '8 weeks',
  student_name: 'Ada Lovelace',
};

function renderPage() {
  return render(
    <MemoryRouter>
      <VerifyCertificate />
    </MemoryRouter>
  );
}

describe('VerifyCertificate page', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('shows the verified certificate details for a valid code', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, { status: 'verified', certificate: verifiedCertificate })
    );

    renderPage();

    expect(await screen.findByText('Verified certificate')).toBeInTheDocument();
    expect(screen.getByText('This certificate is authentic')).toBeInTheDocument();
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('Intro to Data Analytics')).toBeInTheDocument();
    expect(screen.getByText(CODE)).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.queryByText(/certificate not found/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/invalid verification code/i)).not.toBeInTheDocument();
  });

  it('shows "Certificate not found" only when the service genuinely finds no match', async () => {
    fetchMock.mockResolvedValue(jsonResponse(404, {}));

    renderPage();

    expect(await screen.findByText('Certificate not found')).toBeInTheDocument();
    expect(screen.getByText(/no certificate matches code/i)).toBeInTheDocument();
    expect(screen.queryByText('Verified certificate')).not.toBeInTheDocument();
  });

  it('REGRESSION: a service failure shows "Verification unavailable" + retry, not a fake verdict', async () => {
    fetchMock.mockResolvedValue(jsonResponse(500, { message: 'upstream database error' }));

    renderPage();

    expect(await screen.findByText('Verification unavailable')).toBeInTheDocument();
    expect(screen.getByText('upstream database error')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    // The outage must not masquerade as a negative verification verdict.
    expect(screen.queryByText(/certificate not found/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/invalid verification code/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Verified certificate')).not.toBeInTheDocument();
  });

  it('shows the unavailable state on a network error too', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));

    renderPage();

    expect(await screen.findByText('Verification unavailable')).toBeInTheDocument();
    expect(screen.queryByText(/certificate not found/i)).not.toBeInTheDocument();
  });
});

// Direct tests of the fixed component in verify mode. The supabase client is
// globally mocked; we route each table to its own stub so the course lookup
// and the certificate lookup can succeed/fail independently.
describe('CertificationSystem (verify mode)', () => {
  type StubResponse = { row?: unknown; rows?: unknown[]; error?: unknown };

  function tableStub({ row = null, rows = [], error = null }: StubResponse) {
    const b: any = {};
    for (const m of ['select', 'eq', 'in', 'order', 'limit', 'gte', 'lte']) {
      b[m] = vi.fn(() => b);
    }
    b.maybeSingle = vi.fn(async () => ({ data: error ? null : row, error }));
    b.single = vi.fn(async () => ({ data: error ? null : row, error }));
    b.then = (resolve: (v: unknown) => void) =>
      resolve({ data: error ? null : rows, error, count: rows.length });
    return b;
  }

  let tables: Record<string, any>;

  const dbError = { message: 'connection refused', code: 'PGRST000', details: '', hint: '' };

  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({ user: null, loading: false } as any);
    tables = {
      courses: tableStub({ row: makeCourse({ id: 'course-1' }) }),
      certificates: tableStub({ row: makeCertificate({ verification_code: CODE }) }),
    };
    (mockSupabaseClient.from as ReturnType<typeof vi.fn>).mockImplementation(
      (table: string) => tables[table] ?? tableStub({})
    );
  });

  function renderVerify() {
    return render(
      <CertificationSystem courseId="course-1" mode="verify" verificationCode={CODE} />
    );
  }

  it('renders the certificate when the code matches', async () => {
    renderVerify();

    expect(await screen.findByText('Certificate Verification')).toBeInTheDocument();
    expect(screen.getByText(CODE)).toBeInTheDocument();
    expect(screen.getByText('Intro to Data Analytics')).toBeInTheDocument();
    expect(screen.queryByText('Invalid verification code')).not.toBeInTheDocument();
    expect(screen.queryByText(/verification failed/i)).not.toBeInTheDocument();
  });

  it('shows "Invalid verification code" only when the query succeeds with no match', async () => {
    tables.certificates = tableStub({ row: null });

    renderVerify();

    expect(await screen.findByText('Invalid verification code')).toBeInTheDocument();
    expect(screen.queryByText(/verification failed/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument();
  });

  it('REGRESSION: a certificate-query failure renders "Verification failed" + Retry, never "Invalid verification code"', async () => {
    tables.certificates = tableStub({ error: dbError });

    renderVerify();

    expect(
      await screen.findByText(/verification failed — please try again/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/does not mean the certificate is invalid/i)
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    // The outage must never be presented as a verification verdict.
    expect(screen.queryByText('Invalid verification code')).not.toBeInTheDocument();
  });

  it('REGRESSION: a course-query failure also renders the error state, not a verdict', async () => {
    tables.courses = tableStub({ error: dbError });

    renderVerify();

    expect(
      await screen.findByText(/verification failed — please try again/i)
    ).toBeInTheDocument();
    expect(screen.queryByText('Invalid verification code')).not.toBeInTheDocument();
  });

  it('recovers via the Retry button once the backend is healthy again', async () => {
    tables.certificates = tableStub({ error: dbError });

    renderVerify();

    const retry = await screen.findByRole('button', { name: /retry/i });

    // Backend comes back up.
    tables.certificates = tableStub({ row: makeCertificate({ verification_code: CODE }) });
    await userEvent.click(retry);

    expect(await screen.findByText(CODE)).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByText(/verification failed/i)).not.toBeInTheDocument()
    );
    expect(screen.queryByText('Invalid verification code')).not.toBeInTheDocument();
  });
});
