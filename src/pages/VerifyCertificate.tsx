// ABOUTME: Public certificate verification page — anyone can visit
// ABOUTME: /verify-certificate/:code to confirm a certificate is real.
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Award, CheckCircle2, XCircle, ArrowLeft } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';

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

export default function VerifyCertificate() {
  const { code } = useParams<{ code: string }>();
  const [loading, setLoading] = useState(true);
  const [cert, setCert] = useState<VerifiedCert | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!code) { setLoading(false); return; }
      const { data, error } = await supabase.rpc('verify_certificate', { p_code: code });
      if (!alive) return;
      if (error) console.error('verify_certificate error', error);
      const row = Array.isArray(data) ? data[0] : data;
      setCert(row ?? null);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [code]);

  return (
    <div className="min-h-screen bg-neutral-50 py-16 px-4">
      <div className="max-w-2xl mx-auto">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-neutral-600 hover:text-neutral-900 mb-6">
          <ArrowLeft className="h-4 w-4" /> Back home
        </Link>

        {loading ? (
          <Card><CardContent className="py-16 flex justify-center"><Spinner /></CardContent></Card>
        ) : !cert ? (
          <Card className="border-destructive/40">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <XCircle className="h-5 w-5" /> Certificate not found
              </CardTitle>
            </CardHeader>
            <CardContent className="text-neutral-600">
              We couldn't find a certificate with code <code className="font-mono bg-neutral-100 px-1.5 py-0.5 rounded">{code}</code>.
              Double-check the code or ask the certificate holder to re-share the link.
            </CardContent>
          </Card>
        ) : (
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
                <p className="text-xl font-semibold text-neutral-900">{cert.student_name}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-neutral-500 mb-1">Course</p>
                <p className="text-lg text-neutral-900">{cert.course_title ?? 'Course'}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {cert.course_category && <Badge variant="secondary">{cert.course_category}</Badge>}
                  {cert.course_level && <Badge variant="outline">{cert.course_level}</Badge>}
                  {cert.course_duration && <Badge variant="outline">{cert.course_duration}</Badge>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                <div>
                  <p className="text-xs uppercase tracking-wide text-neutral-500 mb-1">Type</p>
                  <p className="capitalize text-neutral-900">{cert.certificate_type}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-neutral-500 mb-1">Issued</p>
                  <p className="text-neutral-900">{new Date(cert.issued_at).toLocaleDateString()}</p>
                </div>
                {cert.certificate_data?.completion_percentage !== undefined && (
                  <div>
                    <p className="text-xs uppercase tracking-wide text-neutral-500 mb-1">Completion</p>
                    <p className="text-neutral-900">{cert.certificate_data.completion_percentage}%</p>
                  </div>
                )}
                <div>
                  <p className="text-xs uppercase tracking-wide text-neutral-500 mb-1">Verification code</p>
                  <p className="font-mono text-sm text-neutral-900">{cert.verification_code}</p>
                </div>
              </div>
              {cert.course_id && (
                <div className="pt-4 border-t">
                  <Button asChild variant="outline" size="sm">
                    <Link to={`/courses/${cert.course_id}`}>View course</Link>
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
