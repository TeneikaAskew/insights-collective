// ABOUTME: Shared data hook for a single course's certificates — the real
// ABOUTME: certificates query plus the count-checked revoke. Used by both the
// ABOUTME: Manage Courses "Certificates" tab and the course detail drawer so
// ABOUTME: the fetch + the "0 rows deleted is a failure" guard live in one place.

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export type CertRow = {
  id: string;
  user_id: string;
  course_id: string;
  certificate_type: string;
  issued_at: string;
  verification_code: string;
  student_name: string;
  student_email: string;
};

export function useCourseCertificates(courseId?: string) {
  const [certs, setCerts] = useState<CertRow[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!courseId) { setCerts([]); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('certificates')
        .select('id, user_id, course_id, certificate_type, issued_at, verification_code, profiles:user_id(first_name, last_name)')
        .eq('course_id', courseId)
        .order('issued_at', { ascending: false });
      if (cancelled) return;
      if (error) {
        toast({ title: 'Failed to load certificates', description: error.message, variant: 'destructive' });
        setCerts([]);
      } else {
        setCerts(
          (data || []).map((r: any) => ({
            id: r.id,
            user_id: r.user_id,
            course_id: r.course_id,
            certificate_type: r.certificate_type || 'completion',
            issued_at: r.issued_at,
            verification_code: r.verification_code,
            student_name: `${r.profiles?.first_name || ''} ${r.profiles?.last_name || ''}`.trim() || 'Student',
            student_email: '',
          })),
        );
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [courseId, toast]);

  const revoke = async (certificate: CertRow): Promise<boolean> => {
    // Ask PostgREST for the affected-row count. Without an admin/instructor
    // DELETE policy a revoke of another user's certificate matches zero rows
    // and returns no error, so a plain "no error" check reports false success
    // while the certificate stays valid. Treat 0 rows deleted as a failure.
    const { error, count } = await supabase
      .from('certificates')
      .delete({ count: 'exact' })
      .eq('id', certificate.id);
    if (error) {
      toast({ title: 'Revoke failed', description: error.message, variant: 'destructive' });
      return false;
    }
    if (!count) {
      toast({
        title: 'Revoke failed',
        description: 'You do not have permission to revoke this certificate, or it no longer exists.',
        variant: 'destructive',
      });
      return false;
    }
    setCerts(prev => prev.filter(c => c.id !== certificate.id));
    toast({
      title: 'Certificate revoked',
      description: `Certificate for ${certificate.student_name} has been revoked.`,
      variant: 'destructive',
    });
    return true;
  };

  return { certs, loading, revoke };
}
