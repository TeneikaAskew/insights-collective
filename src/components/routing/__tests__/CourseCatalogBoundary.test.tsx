import React, { lazy, Suspense } from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, render, screen, act, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, Link } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import CourseCatalogBoundary from '../CourseCatalogBoundary';

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function mockDocumentReload() {
  const reload = vi.fn();
  const realWindow = window;
  // Do not overwrite jsdom's non-configurable Location methods.
  vi.stubGlobal('window', new Proxy(realWindow, {
    get(target, key) { return key === 'location' ? { reload } : Reflect.get(target, key, target); },
  }));
  return reload;
}

function mountCatalog(Page: React.ComponentType, path = '/courses?topic=data#catalog') {
  return render(<MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <Link to="/">Home navigation</Link>
    <Suspense fallback={<p>Loading catalog</p>}><Routes>
      <Route path="/" element={<h1>Home</h1>} />
      {['/courses', '/course-list'].map(p => <Route key={p} path={p} element={
        <CourseCatalogBoundary><Page /></CourseCatalogBoundary>
      } />)}
    </Routes></Suspense>
  </MemoryRouter>);
}

test('rejected CourseList import renders recovery instead of an empty route', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const load = vi.fn(() => Promise.reject(new TypeError('Failed to fetch dynamically imported module: synthetic-private-detail')));
  mountCatalog(lazy(load));
  expect((await screen.findByRole('alert')).textContent).toContain('Could not open the course catalog');
  expect(screen.getByRole('button', { name: 'Reload this page' }).getAttribute('type')).toBe('button');
  expect(screen.getByRole('link', { name: 'Go to homepage' }).getAttribute('href')).toBe('/');
  expect(screen.queryByText(/synthetic-private-detail/)).toBeNull();
  await act(async () => { await Promise.resolve(); });
  expect(load).toHaveBeenCalledTimes(1); // No automatic import retries/reload loop.
  fireEvent.click(screen.getByRole('link', { name: 'Home navigation' }));
  expect(await screen.findByRole('heading', { name: 'Home' })).toBeTruthy();
});

test('pending import still shows loading and successful import shows catalog', async () => {
  let resolve!: (m: {default: React.ComponentType}) => void;
  const pending = new Promise<{default: React.ComponentType}>(r => { resolve = r; });
  mountCatalog(lazy(() => pending));
  expect(screen.getByText('Loading catalog')).toBeTruthy();
  expect(screen.queryByRole('alert')).toBeNull();
  await act(async () => resolve({default: () => <h1>Synthetic catalog</h1>}));
  expect(screen.getByRole('heading', {name: 'Synthetic catalog'})).toBeTruthy();
});

test('legacy catalog alias has the same non-looping recovery', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  mountCatalog(lazy(() => Promise.reject(new Error('offline fixture'))), '/course-list');
  await screen.findByRole('alert');
  expect(screen.getByRole('button', {name: 'Reload this page'})).toBeTruthy();
});

test('ordinary rendering errors get truthful generic recovery without raw details', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  mountCatalog(() => { throw new Error('sensitive synthetic runtime detail'); });
  expect((await screen.findByRole('alert')).textContent).toContain('Could not open the course catalog');
  expect(screen.queryByText(/sensitive synthetic/)).toBeNull();
});

test('recovery actions are reachable by Tab and activate with Enter', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const user = userEvent.setup();
  mountCatalog(lazy(() => Promise.reject(new Error('synthetic import failure'))));
  await screen.findByRole('alert');
  const reload = screen.getByRole('button', { name: 'Reload this page' });
  const reloadDocument = mockDocumentReload();
  const home = screen.getByRole('link', { name: 'Go to homepage' });
  const activate = vi.fn((event: Event) => event.preventDefault());
  // Observe native activation without asking jsdom to navigate a document.
  home.addEventListener('click', activate);
  await user.tab(); // The surrounding app's navigation remains available.
  await user.tab();
  expect(document.activeElement).toBe(reload);
  await user.keyboard('{Enter}');
  expect(reloadDocument).toHaveBeenCalledTimes(1);
  await user.tab();
  expect(document.activeElement).toBe(home);
  await user.keyboard('{Enter}');
  expect(activate).toHaveBeenCalledTimes(1);
});

// jsdom cannot reload documents. Intercept only the browser reload API; do not
// suppress click/keyboard events or claim this proves browser document identity.
test.each(['/courses?topic=data#catalog', '/course-list?topic=data#catalog'])(
  'explicit document reload preserves query and fragment for %s', async (url) => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const user = userEvent.setup();
    const realWindow = window;
    const originalUrl = realWindow.location.href;
    realWindow.history.replaceState(null, '', url);
    const currentUrl = realWindow.location.href;
    const reload = mockDocumentReload();
    try {
      const load = vi.fn(() => Promise.reject(new Error('synthetic rejected catalog import')));
      mountCatalog(lazy(load), url);
      await screen.findByRole('alert');
      expect(reload).not.toHaveBeenCalled();
      const button = screen.getByRole('button', { name: 'Reload this page' });
      await user.tab();
      await user.tab();
      expect(document.activeElement).toBe(button);
      await user.keyboard('{Enter}');
      expect(reload).toHaveBeenCalledExactlyOnceWith();
      expect(realWindow.location.href).toBe(currentUrl);
      await act(async () => { await Promise.resolve(); });
      expect(reload).toHaveBeenCalledTimes(1);
      expect(load).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
      realWindow.history.replaceState(null, '', originalUrl);
    }
  },
);
