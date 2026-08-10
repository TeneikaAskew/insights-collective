// ABOUTME: Pins the shared render helper against the provider tree main.tsx
// ABOUTME: mounts, so a page cannot have a context in production and not in tests.

import { describe, it, expect } from 'vitest';
import { render, screen } from '../test-utils';
import PageSeo from '@/components/seo/PageSeo';

/**
 * Why a test for the test harness
 * -------------------------------
 * When pages picked up <PageSeo>, which renders react-helmet-async's <Helmet>,
 * this helper had no <HelmetProvider>. HelmetDispatcher.init reads
 * `context.helmetInstances.add` off the empty object it falls back to, so every
 * render through the shared helper threw "Cannot read properties of undefined
 * (reading 'add')" — 14 tests across Blog and CourseDetail, failing before a
 * single assertion in them ran.
 *
 * Nothing said the harness was the cause. The stack pointed at react-dom, the
 * app itself was fine, and the two suites simply went red together. Rendering
 * the real component that needs the real provider is what turns the next
 * omission into one obvious failure here rather than a scattering of them.
 */
describe('the shared render helper', () => {
  it('supplies the Helmet context that PageSeo needs', () => {
    // PageSeo renders no visible output — the assertion is that this does not
    // throw, and that children beside it still mount.
    expect(() =>
      render(
        <>
          <PageSeo title="Test" description="Test page" path="/test" />
          <p>rendered beside a Helmet consumer</p>
        </>,
      ),
    ).not.toThrow();

    expect(screen.getByText('rendered beside a Helmet consumer')).toBeInTheDocument();
  });

  it('gives each render its own Helmet context', () => {
    // A shared context object accumulates every mounted instance, which makes
    // the suite order-dependent. Two renders in a row must both be clean.
    render(<PageSeo title="First" description="one" path="/first" />);
    expect(() => render(<PageSeo title="Second" description="two" path="/second" />)).not.toThrow();
  });
});
