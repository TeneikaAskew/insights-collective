// Shared authentication + authorization for edge functions.
//
// Every function used to hand-roll this, and most of them skipped it entirely.
// `verify_jwt = true` is not a gate: the anon key ships in the frontend bundle
// and satisfies it, so a function that relies on it alone is reachable by
// anyone who has ever loaded the site. These helpers do the real check.
//
// Usage:
//
//   const auth = await requireUser(req);
//   if (auth.response) return auth.response;   // 401 already formed
//   const { user, admin } = auth;              // user.id is trustworthy
//
// `admin` is a service-role client for the work the function actually needs to
// do. Reach for it only after the caller's identity has been established, and
// scope every query by `user.id` — a service-role client bypasses RLS, so it is
// the function's job to re-impose the boundary RLS would have enforced.

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from './utils.ts';

export interface AuthenticatedUser {
  id: string;
  email?: string;
}

export interface AuthSuccess {
  response: null;
  user: AuthenticatedUser;
  /** Service-role client. Bypasses RLS — scope your own queries. */
  admin: SupabaseClient;
  /** Client carrying the caller's JWT, so RLS applies as that user. */
  asUser: SupabaseClient;
}

export interface AuthFailure {
  response: Response;
  user: null;
  admin: null;
  asUser: null;
}

export type AuthResult = AuthSuccess | AuthFailure;

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const fail = (message: string, status: number): AuthFailure => ({
  response: json({ error: message }, status),
  user: null,
  admin: null,
  asUser: null,
});

function serviceClient(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

/**
 * Resolve the caller from their JWT. Returns a 401 response when the request
 * carries no usable session.
 */
export async function requireUser(req: Request): Promise<AuthResult> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return fail('Missing authorization header', 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

  const asUser = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: { user }, error } = await asUser.auth.getUser();
  if (error || !user) {
    return fail('Invalid or expired session', 401);
  }

  return {
    response: null,
    user: { id: user.id, email: user.email ?? undefined },
    admin: serviceClient(),
    asUser,
  };
}

/**
 * Resolve the caller and require an admin role. Authorization reads `user_roles`
 * through has_admin_access() — never the `profiles.roles` column, which is
 * owner-writable and would let a user self-promote.
 */
export async function requireAdmin(req: Request): Promise<AuthResult> {
  const auth = await requireUser(req);
  if (auth.response) return auth;

  const { data: isAdmin, error } = await auth.admin
    .rpc('has_admin_access', { user_id_param: auth.user.id });

  if (error) {
    console.error('requireAdmin: has_admin_access failed:', error.message);
    return fail('Failed to verify permissions', 500);
  }
  if (!isAdmin) {
    return fail('Admin privileges required', 403);
  }
  return auth;
}

/**
 * Resolve the caller and require that they can manage the given course —
 * its instructor, or an admin. Used by the content-authoring endpoints.
 */
export async function requireCourseManager(
  req: Request,
  courseId: string | null | undefined,
): Promise<AuthResult> {
  const auth = await requireUser(req);
  if (auth.response) return auth;

  const { data: isAdmin } = await auth.admin
    .rpc('has_admin_access', { user_id_param: auth.user.id });
  if (isAdmin) return auth;

  if (!courseId) {
    return fail('Instructor privileges required', 403);
  }

  const { data: canManage, error } = await auth.admin
    .rpc('can_manage_course_materials', { _user: auth.user.id, _course: courseId });

  if (error) {
    console.error('requireCourseManager: can_manage_course_materials failed:', error.message);
    return fail('Failed to verify permissions', 500);
  }
  if (!canManage) {
    return fail('Instructor privileges required', 403);
  }
  return auth;
}

/**
 * Admin users, or a caller presenting the service-role key directly. For
 * endpoints that a scheduler is expected to hit as well as a human — the
 * service-role key is a server-side secret, so presenting it is proof enough.
 *
 * `isService` tells the handler which of the two it got, so trusting a body flag
 * like `automated: true` can be gated on it instead of on the caller's word.
 */
export async function requireAdminOrService(
  req: Request,
): Promise<AuthResult & { isService?: boolean }> {
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace('Bearer ', '').trim();
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  if (token && serviceKey && token === serviceKey) {
    return {
      response: null,
      user: { id: 'service-role' },
      admin: serviceClient(),
      asUser: serviceClient(),
      isService: true,
    };
  }

  const auth = await requireAdmin(req);
  return { ...auth, isService: false };
}

/**
 * Resolve the caller and require any staff role (instructor or admin), without
 * tying the check to a specific course. For endpoints that generate draft
 * content not yet attached to anything.
 */
export async function requireStaff(req: Request): Promise<AuthResult> {
  const auth = await requireUser(req);
  if (auth.response) return auth;

  const { data: roles, error } = await auth.admin
    .rpc('get_user_roles', { _user_id: auth.user.id });

  if (error) {
    console.error('requireStaff: get_user_roles failed:', error.message);
    return fail('Failed to verify permissions', 500);
  }

  const list: string[] = Array.isArray(roles) ? roles : [];
  if (!list.includes('admin') && !list.includes('instructor')) {
    return fail('Instructor privileges required', 403);
  }
  return auth;
}

export { json as authJson };
