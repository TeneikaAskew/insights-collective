// ABOUTME: A member denied at an admin route is logged and told ONCE, outside render, and reaches /dashboard with the
// ABOUTME: router's v7_startTransition on (as in App.tsx). Real ToastProvider/Toaster; auth and Supabase mocked.
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Toaster } from '@/components/ui/toaster';
import { ToastProvider } from '@/hooks/use-toast';
import { mockSupabaseClient } from '@/test/mocks/supabase';

const auth = vi.hoisted(() => ({ session: { access_token: 'token', user: { id: 'member-1' }, expires_at: 4102444800 } }));
vi.mock('@/contexts/AuthContext', async (orig) => ({ ...(await orig<typeof import('@/contexts/AuthContext')>()),
  useAuth: () => ({ isAuthenticated: true, user: { id: 'member-1', roles: ['student'] }, session: auth.session, loading: false, storeRedirectPath: () => {} }) }));

const RENDER_PHASE = /Cannot update a component .* while rendering a different component/;
const tree = (initial: string) => (
  <ToastProvider>
    <MemoryRouter initialEntries={[initial]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Toaster />
      <Routes>
        <Route path="/admin" element={<ProtectedRoute requireAdmin><div>ADMIN</div></ProtectedRoute>} />
        <Route path="/courses" element={<ProtectedRoute><div>COURSES</div></ProtectedRoute>} />
        <Route path="/dashboard" element={<div>DASHBOARD</div>} />
        <Route path="/login" element={<div>LOGIN</div>} />
      </Routes>
    </MemoryRouter>
  </ToastProvider>
);

describe('ProtectedRoute member denial', () => {
  it('logs one denial, shows one toast, updates no state during render, and lands on /dashboard', async () => {
    const calls: string[] = [];
    mockSupabaseClient.rpc = vi.fn(async (fn: string, args: Record<string, unknown>) => {
      calls.push(fn === 'log_security_event' ? `log:${String(args.p_event_type)}` : fn);
      return { data: fn === 'has_admin_access' ? false : null, error: null };
    }) as never;
    const renderPhase: string[] = [];
    const spy = vi.spyOn(console, 'error').mockImplementation((...a) => {
      const msg = String(a[0]);
      if (RENDER_PHASE.test(msg)) renderPhase.push(msg.slice(0, 120));
    });
    render(tree('/admin'));
    await waitFor(() => expect(screen.getByText('DASHBOARD')).toBeInTheDocument());
    // Let any further renders and their effects run before counting.
    await act(async () => { await new Promise((r) => setTimeout(r, 100)); });
    spy.mockRestore();
    expect(screen.queryByText('ADMIN')).not.toBeInTheDocument();
    expect(calls.filter((c) => c === 'has_admin_access')).toHaveLength(1);
    expect(calls.filter((c) => c === 'log:protected_route_access')).toHaveLength(1);
    expect(calls.filter((c) => c === 'log:unauthorized_protected_access')).toHaveLength(1);
    expect(screen.getAllByText('Access Denied')).toHaveLength(1);
    expect(renderPhase).toEqual([]);
  });

  it('an expired session shows one Session Invalid notice and lands on /login', async () => {
    auth.session = { access_token: 'token', user: { id: 'member-1' }, expires_at: 1 };
    const renderPhase: string[] = [];
    const spy = vi.spyOn(console, 'error').mockImplementation((...a) => { if (RENDER_PHASE.test(String(a[0]))) renderPhase.push(String(a[0]).slice(0, 120)); });
    render(tree('/courses'));
    await waitFor(() => expect(screen.getByText('LOGIN')).toBeInTheDocument());
    await act(async () => { await new Promise((r) => setTimeout(r, 100)); });
    spy.mockRestore();
    expect(screen.getAllByText('Session Invalid')).toHaveLength(1);
    expect(renderPhase).toEqual([]);
  });
});
