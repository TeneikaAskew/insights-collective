// ABOUTME: A denial is announced and logged once per distinct identity (user, protected path, reason), not once per
// ABOUTME: mount. Navigate is stubbed so the guard stays mounted, as when a redirect is interrupted before it commits.
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route, Outlet, useNavigate } from 'react-router-dom';
import ProtectedRoute, { RedirectWithNotice } from '@/components/ProtectedRoute';
import { mockSupabaseClient } from '@/test/mocks/supabase';

const toastSpy = vi.hoisted(() => vi.fn());
vi.mock('@/hooks/use-toast', async (orig) => ({ ...(await orig<typeof import('@/hooks/use-toast')>()), useToast: () => ({ toast: toastSpy }) }));
// The redirect never commits, so the guard and its notice stay mounted across navigations and user changes.
vi.mock('react-router-dom', async (orig) => ({ ...(await orig<typeof import('react-router-dom')>()),
  Navigate: ({ to }: { to: string }) => <div data-testid="redirect">{to}</div> }));

const auth = vi.hoisted(() => ({ id: 'member-1', loading: false, session: { access_token: 't', user: { id: 'member-1' }, expires_at: 4102444800 } as object }));
vi.mock('@/contexts/AuthContext', async (orig) => ({ ...(await orig<typeof import('@/contexts/AuthContext')>()),
  useAuth: () => ({ isAuthenticated: true, user: { id: auth.id, roles: ['student'] }, session: auth.session, loading: auth.loading, storeRedirectPath: () => {} }) }));

let go: (to: string) => void = () => {};
const Nav = () => { go = useNavigate(); return null; };
const tree = (initial: string) => (
  <MemoryRouter initialEntries={[initial]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <Nav />
    <Routes>
      <Route path="/admin" element={<ProtectedRoute requireAdmin><Outlet /></ProtectedRoute>}>
        <Route path="a" element={<div>ADMIN-A</div>} />
        <Route path="b" element={<div>ADMIN-B</div>} />
      </Route>
    </Routes>
  </MemoryRouter>
);

const calls: { fn: string; args: Record<string, unknown> }[] = [];
const admins = new Set<string>();
let rpcError: { message: string } | null = null;
const denials = () => calls.filter((c) => c.fn === 'log_security_event' && c.args.p_event_type === 'unauthorized_protected_access')
  .map((c) => `${c.args.p_user_id}${(c.args.p_metadata as { path?: string })?.path ?? ''}`);
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 50)); });

beforeEach(() => {
  calls.length = 0; admins.clear(); rpcError = null; toastSpy.mockClear();
  Object.assign(auth, { id: 'member-1', loading: false, session: { access_token: 't', user: { id: 'member-1' }, expires_at: 4102444800 } });
  mockSupabaseClient.rpc = vi.fn(async (fn: string, args: Record<string, unknown>) => {
    calls.push({ fn, args });
    if (fn === 'has_admin_access') return rpcError ? { data: null, error: rpcError } : { data: admins.has(String(args.user_id_param)), error: null };
    return { data: null, error: null };
  }) as never;
});

describe('RedirectWithNotice dedupes on identity, not mount', () => {
  it('same key: one notice across re-renders with new closures; new key: a new notice', async () => {
    const shown: string[] = [];
    const el = (k: string) => <MemoryRouter><RedirectWithNotice to="/x" title="T" description="D" noticeKey={k} onShown={() => shown.push(k)} /></MemoryRouter>;
    const { rerender } = render(el('k1'));
    rerender(el('k1')); rerender(el('k1'));
    expect(shown).toEqual(['k1']);
    rerender(el('k2'));
    rerender(el('k2'));
    expect(shown).toEqual(['k1', 'k2']);
    expect(toastSpy).toHaveBeenCalledTimes(2);
  });

  it('StrictMode double effects announce once', async () => {
    const shown: string[] = [];
    render(<React.StrictMode><MemoryRouter><RedirectWithNotice to="/x" title="T" description="D" noticeKey="k" onShown={() => shown.push('k')} /></MemoryRouter></React.StrictMode>);
    await settle();
    expect(shown).toEqual(['k']);
    expect(toastSpy).toHaveBeenCalledTimes(1);
  });
});

describe('ProtectedRoute denial identity without unmount', () => {
  it('interrupted nested admin navigation a -> b -> a logs each distinct attempt once, nothing on same-identity refresh', async () => {
    const { rerender } = render(tree('/admin/a'));
    await settle();
    expect(denials()).toEqual(['member-1/admin/a']);
    act(() => go('/admin/b')); await settle();
    act(() => go('/admin/a')); await settle();
    expect(denials()).toEqual(['member-1/admin/a', 'member-1/admin/b', 'member-1/admin/a']);
    // Token refresh: a new session object for the same user and path is not a new denial.
    auth.session = { ...auth.session }; rerender(tree('/admin/a')); await settle();
    expect(denials()).toHaveLength(3);
    expect(toastSpy).toHaveBeenCalledTimes(3);
    expect(screen.getByTestId('redirect').textContent).toBe('/dashboard');
    expect(screen.queryByText('ADMIN-A')).toBeNull();
  });

  it('user change without unmount: a stale denial is never applied to the next user; a new non-admin is logged', async () => {
    admins.add('admin-2');
    const { rerender } = render(tree('/admin/a'));
    await settle();
    expect(denials()).toEqual(['member-1/admin/a']);
    auth.id = 'admin-2'; rerender(tree('/admin/a'));
    // Before admin-2's own check replies, member-1's denial must not redirect admin-2 (pending, not denied).
    expect(screen.queryByTestId('redirect')).toBeNull();
    await settle();
    expect(screen.getByText('ADMIN-A')).toBeTruthy();
    expect(denials()).toEqual(['member-1/admin/a']);
    auth.id = 'member-3'; rerender(tree('/admin/a')); await settle();
    expect(denials()).toEqual(['member-1/admin/a', 'member-3/admin/a']);
    expect(screen.queryByText('ADMIN-A')).toBeNull();
  });

  it('a different non-admin user while the denial stays mounted is logged as their own denial', async () => {
    const { rerender } = render(tree('/admin/a'));
    await settle();
    auth.id = 'member-3'; rerender(tree('/admin/a')); await settle();
    expect(denials()).toEqual(['member-1/admin/a', 'member-3/admin/a']);
    expect(toastSpy).toHaveBeenCalledTimes(2);
  });

  // Deferred replies, resolved out of order: the first user's reply lands AFTER the second user's.
  const deferred = () => { const waits = new Map<string, (v: boolean) => void>();
    mockSupabaseClient.rpc = vi.fn((fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args });
      if (fn !== 'has_admin_access') return Promise.resolve({ data: null, error: null });
      return new Promise((res) => waits.set(String(args.user_id_param), (v) => res({ data: v, error: null })));
    }) as never;
    return (id: string, v: boolean) => act(async () => { waits.get(id)!(v); await new Promise((r) => setTimeout(r, 20)); }); };

  it('A pending, switch to admin B, B resolves, then A resolves: B keeps its grant (no spinner forever, no denial)', async () => {
    const resolve = deferred();
    const { rerender } = render(tree('/admin/a'));
    await settle();
    auth.id = 'admin-2'; rerender(tree('/admin/a')); await settle();
    await resolve('admin-2', true);
    expect(screen.getByText('ADMIN-A')).toBeTruthy();
    await resolve('member-1', false);
    expect(screen.getByText('ADMIN-A')).toBeTruthy();
    expect(screen.queryByText('Verifying access...')).toBeNull();
    expect(screen.queryByTestId('redirect')).toBeNull();
    expect(denials()).toEqual([]);
  });

  it('admin A pending, switch to member B, B resolves, then A resolves: A\'s late grant never admits B', async () => {
    const resolve = deferred();
    auth.id = 'admin-0';
    const { rerender } = render(tree('/admin/a'));
    await settle();
    auth.id = 'member-1'; rerender(tree('/admin/a')); await settle();
    await resolve('member-1', false);
    expect(denials()).toEqual(['member-1/admin/a']);
    await resolve('admin-0', true);
    expect(screen.queryByText('ADMIN-A')).toBeNull();
    expect(screen.getByTestId('redirect').textContent).toBe('/dashboard');
    expect(denials()).toEqual(['member-1/admin/a']);
  });

  it('loading: no decision, notice or log until auth settles, then exactly one', async () => {
    auth.loading = true;
    const { rerender } = render(tree('/admin/a'));
    await settle();
    expect(screen.queryByTestId('redirect')).toBeNull();
    expect(denials()).toEqual([]);
    expect(toastSpy).not.toHaveBeenCalled();
    auth.loading = false; rerender(tree('/admin/a')); await settle();
    expect(denials()).toEqual(['member-1/admin/a']);
    expect(toastSpy).toHaveBeenCalledTimes(1);
  });

  it('a failed admin check still denies (access decision unchanged) and is announced once', async () => {
    rpcError = { message: 'boom' };
    render(tree('/admin/a'));
    await settle();
    expect(calls.filter((c) => c.args.p_event_type === 'protected_route_admin_check_failed')).toHaveLength(1);
    expect(denials()).toEqual(['member-1/admin/a']);
    expect(screen.getByTestId('redirect').textContent).toBe('/dashboard');
  });
});
