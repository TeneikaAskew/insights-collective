// ABOUTME: Public certificate verification page — anyone can visit
// ABOUTME: /verify-certificate/:code to confirm a certificate is real.
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Award, CheckCircle2, XCircle, ArrowLeft, ShieldAlert, Clock } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';
import { securityConfig } from '@/config/security';

type VerifiedCert = {
  verification_code: string;
  certificate_type: string;
  issued_at: string;
  certificate_data: any;
  course_id: string | null;
  course_title: string | null;
  course_category: string | null;
  course_level: string | null;
  course_duration: string | null;
  student_name: string;
};

type State =
  | { kind: 'loading' }
  | { kind: 'verified'; cert: VerifiedCert }
  | { kind: 'not_found' }
  | { kind: 'invalid_format' }
  | { kind: 'rate_limited'; retryIn: number }
  | { kind: 'error'; message: string };

// Resolve the functions host the same way the rest of the app resolves
// Supabase. This used to read VITE_SUPABASE_PROJECT_ID — a variable used
// nowhere else — and fall back to a relative path, which resolves to the SPA
// itself. Any deployment setting VITE_SUPABASE_URL but not the project id got
// index.html back for every lookup and showed "Verification unavailable",
// including for valid certificates.
const FUNCTIONS_BASE = `${securityConfig.supabase.url.replace(/\/$/, '')}/functions/v1`;

export default function VerifyCertificate() {
  const { code } = useParams<{ code: string }>();
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!code) { setState({ kind: 'invalid_format' }); return; }
      try {
        const res = await fetch(`${FUNCTIONS_BASE}/verify-certificate?code=${encodeURIComponent(code)}`, {
          headers: { 'Content-Type': 'application/json' },
        });
        const body = await res.json().catch(() => ({}));
        if (!alive) return;
        if (res.status === 200 && body.status === 'verified') {
          setState({ kind: 'verified', cert: body.certificate });
        } else if (res.status === 404) {
          setState({ kind: 'not_found' });
        } else if (res.status === 400) {
          setState({ kind: 'invalid_format' });
        } else if (res.status === 429) {
          setState({ kind: 'rate_limited', retryIn: body.retry_after_seconds ?? 60 });
        } else {
          setState({ kind: 'error', message: body.message ?? 'Verification service is unavailable. Please try again shortly.' });
        }
      } catch (e: any) {
        if (!alive) return;
        setState({ kind: 'error', message: e?.message ?? 'Network error' });
      }
    })();
    return () => { alive = false; };
  }, [code]);

  return (
    <div className="min-h-screen bg-neutral-50 py-16 px-4">
      <div className="max-w-2xl mx-auto">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-neutral-600 hover:text-neutral-900 mb-6">
          <ArrowLeft className="h-4 w-4" /> Back home
        </Link>

        {state.kind === 'loading' && (
          <Card><CardContent className="py-16 flex justify-center"><Spinner /></CardContent></Card>
        )}

        {state.kind === 'invalid_format' && (
          <Card className="border-destructive/40">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <ShieldAlert className="h-5 w-5" /> Invalid verification code
              </CardTitle>
            </CardHeader>
            <CardContent className="text-neutral-600 space-y-2">
              <p>Verification codes are 6–32 letters and numbers only.</p>
              <p>The code <code className="font-mono bg-neutral-100 px-1.5 py-0.5 rounded">{code}</code> doesn't match that format — please check the link you were sent.</p>
            </CardContent>
          </Card>
        )}

        {state.kind === 'not_found' && (
          <Card className="border-destructive/40">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <XCircle className="h-5 w-5" /> Certificate not found
              </CardTitle>
            </CardHeader>
            <CardContent className="text-neutral-600">
              No certificate matches code <code className="font-mono bg-neutral-100 px-1.5 py-0.5 rounded">{code}</code>.
              Double-check the code or ask the certificate holder to re-share the link.
            </CardContent>
          </Card>
        )}

        {state.kind === 'rate_limited' && (
          <Card className="border-amber-300">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-700">
                <Clock className="h-5 w-5" /> Too many attempts
              </CardTitle>
            </CardHeader>
            <CardContent className="text-neutral-600 space-y-3">
              <p>We've received a lot of verification requests from your network in the last minute.</p>
              <p>Please wait about {state.retryIn} seconds and try again.</p>
              <Button variant="outline" onClick={() => window.location.reload()}>Try again</Button>
            </CardContent>
          </Card>
        )}

        {state.kind === 'error' && (
          <Card className="border-destructive/40">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <ShieldAlert className="h-5 w-5" /> Verification unavailable
              </CardTitle>
            </CardHeader>
            <CardContent className="text-neutral-600 space-y-3">
              <p>{state.message}</p>
              <Button variant="outline" onClick={() => window.location.reload()}>Try again</Button>
            </CardContent>
          </Card>
        )}

        {state.kind === 'verified' && (
          <Card className="border-emerald-200">
            <CardHeader className="border-b bg-gradient-to-br from-primary/5 to-emerald-50">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Award className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-2xl">Verified certificate</CardTitle>
                  <p className="text-sm text-emerald-700 flex items-center gap-1.5 mt-1">
                    <CheckCircle2 className="h-4 w-4" /> This certificate is authentic
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-5">
              <div>
                <p className="text-xs uppercase tracking-wide text-neutral-500 mb-1">Awarded to</p>
                <p className="text-xl font-semibold text-neutral-900">{state.cert.student_name}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-neutral-500 mb-1">Course</p>
                <p className="text-lg text-neutral-900">{state.cert.course_title ?? 'Course'}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {state.cert.course_category && <Badge variant="secondary">{state.cert.course_category}</Badge>}
                  {state.cert.course_level && <Badge variant="outline">{state.cert.course_level}</Badge>}
                  {state.cert.course_duration && <Badge variant="outline">{state.cert.course_duration}</Badge>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                <div>
                  <p className="text-xs uppercase tracking-wide text-neutral-500 mb-1">Type</p>
                  <p className="capitalize text-neutral-900">{state.cert.certificate_type}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-neutral-500 mb-1">Issued</p>
                  <p className="text-neutral-900">{new Date(state.cert.issued_at).toLocaleDateString()}</p>
                </div>
                {state.cert.certificate_data?.completion_percentage !== undefined && (
                  <div>
                    <p className="text-xs uppercase tracking-wide text-neutral-500 mb-1">Completion</p>
                    <p className="text-neutral-900">{state.cert.certificate_data.completion_percentage}%</p>
                  </div>
                )}
                <div>
                  <p className="text-xs uppercase tracking-wide text-neutral-500 mb-1">Verification code</p>
                  <p className="font-mono text-sm text-neutral-900">{state.cert.verification_code}</p>
                </div>
              </div>
              {state.cert.course_id && (
                <div className="pt-4 border-t">
                  <Button asChild variant="outline" size="sm">
                    <Link to={`/courses/${state.cert.course_id}`}>View course</Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
