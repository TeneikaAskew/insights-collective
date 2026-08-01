import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import VisibilityGate from '../VisibilityGate';

const mockUsePageVisibility = vi.fn();

vi.mock('@/contexts/PageVisibilityContext', () => ({
  usePageVisibility: () => mockUsePageVisibility(),
}));

// The real ComingSoon renders the full AppLayout (auth, sidebar…); the gate
// contract under test is only "which branch renders", so stub it.
vi.mock('@/pages/ComingSoon', () => ({
  default: () => <div data-testid="coming-soon">Coming Soon</div>,
}));

const pageEffectSpy = vi.fn();
const pageFetchSpy = vi.fn();

function GatedPage() {
  // Stands in for a real page's data fetching + side effects: if the gate
  // mounts us at all, both spies fire.
  pageFetchSpy();
  useEffect(() => {
    pageEffectSpy();
  }, []);
  return <div>Secret page content</div>;
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<VisibilityGate />}>
          <Route path="/resume" element={<GatedPage />} />
          <Route path="/login" element={<div>Login form</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('VisibilityGate', () => {
  it('renders the page when visible', () => {
    mockUsePageVisibility.mockReturnValue({ isReady: true, isPageVisible: () => true });
    renderAt('/resume');
    expect(screen.getByText('Secret page content')).toBeInTheDocument();
    expect(pageEffectSpy).toHaveBeenCalled();
  });

  it('never mounts a hidden page — no render, no effects', () => {
    mockUsePageVisibility.mockReturnValue({ isReady: true, isPageVisible: () => false });
    renderAt('/resume');
    expect(screen.getByTestId('coming-soon')).toBeInTheDocument();
    expect(screen.queryByText('Secret page content')).not.toBeInTheDocument();
    expect(pageFetchSpy).not.toHaveBeenCalled();
    expect(pageEffectSpy).not.toHaveBeenCalled();
  });

  it('fails closed while loading — spinner only, page not mounted', () => {
    mockUsePageVisibility.mockReturnValue({ isReady: false, isPageVisible: () => true });
    const { container } = renderAt('/resume');
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
    expect(screen.queryByText('Secret page content')).not.toBeInTheDocument();
    expect(screen.queryByTestId('coming-soon')).not.toBeInTheDocument();
    expect(pageFetchSpy).not.toHaveBeenCalled();
  });

  it('lets ungated paths through even while loading and when hidden', () => {
    const isPageVisible = vi.fn(() => false);
    mockUsePageVisibility.mockReturnValue({ isReady: false, isPageVisible });
    renderAt('/login');
    expect(screen.getByText('Login form')).toBeInTheDocument();
    expect(isPageVisible).not.toHaveBeenCalled();
  });

  describe('when the visibility fetch failed', () => {
    it('says the settings could not load, rather than that the page is coming soon', () => {
      // Same fail-closed outcome as a deliberate toggle, deliberately different
      // words: an outage used to render "This page will be available to your
      // account soon — contact your administrator", blaming the reader's account
      // for a database failure, on every managed page at once.
      mockUsePageVisibility.mockReturnValue({
        isReady: true,
        loadError: true,
        isPageVisible: () => false,
        retry: vi.fn(),
      });
      renderAt('/resume');
      expect(screen.getByTestId('visibility-unavailable')).toBeInTheDocument();
      expect(screen.queryByTestId('coming-soon')).not.toBeInTheDocument();
      expect(pageFetchSpy).not.toHaveBeenCalled();
    });

    it('still renders pages the predicate allows during the error', () => {
      // REGRESSION: the outage branch used to run BEFORE isPageVisible, which
      // blanked routes that predicate deliberately still permits under
      // loadError — every page for admins, and any unmanaged path (redirect-only
      // routes like /career-agent) for everyone. An outage must not remove
      // access that was never gated in the first place.
      mockUsePageVisibility.mockReturnValue({
        isReady: true,
        loadError: true,
        isPageVisible: () => true,
        retry: vi.fn(),
      });
      renderAt('/resume');
      expect(screen.getByText('Secret page content')).toBeInTheDocument();
      expect(screen.queryByTestId('visibility-unavailable')).not.toBeInTheDocument();
    });
  });
});
