// ABOUTME: Renders the list of certificates the signed-in user has earned across
// ABOUTME: every course, with download-as-PDF and public verification-link actions.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Award, Download, ExternalLink, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { createLogger } from '@/utils/logger';

const logger = createLogger('MyCertificates');

interface CertificateRow {
  id: string;
  course_id: string;
  certificate_type: string;
  issued_at: string;
  verification_code: string;
  certificate_data: {
    course_title?: string;
    completion_percentage?: number;
    time_spent?: number;
  } | null;
  course?: { title: string | null; category: string | null; level: string | null; duration: string | null } | null;
}

const formatTime = (seconds?: number) => {
  if (!seconds) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

export const MyCertificates = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [certificates, setCertificates] = useState<CertificateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('certificates')
        .select('id, course_id, certificate_type, issued_at, verification_code, certificate_data, course:courses(title, category, level, duration)')
        .eq('user_id', user.id)
        .order('issued_at', { ascending: false });
      if (error) {
        logger.error('Failed to load certificates', error);
      } else {
        setCertificates((data as any) || []);
      }
      setLoading(false);
    };
    load();
  }, [user?.id]);

  const handleDownload = async (cert: CertificateRow) => {
    setDownloadingId(cert.id);
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      doc.setDrawColor(120, 90, 200);
      doc.setLineWidth(6);
      doc.rect(24, 24, pageWidth - 48, pageHeight - 48);
      doc.setLineWidth(1);
      doc.rect(36, 36, pageWidth - 72, pageHeight - 72);

      const title = cert.certificate_data?.course_title || cert.course?.title || 'Course Completion';
      const recipient = (user as any)?.user_metadata?.full_name || user?.email || 'Student';

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(34);
      doc.setTextColor(40, 40, 60);
      doc.text(`Certificate of ${cert.certificate_type.replace(/^./, (c) => c.toUpperCase())}`, pageWidth / 2, 130, { align: 'center' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(14);
      doc.setTextColor(90, 90, 110);
      doc.text('This certificate is proudly presented to', pageWidth / 2, 180, { align: 'center' });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(28);
      doc.setTextColor(40, 40, 60);
      doc.text(recipient, pageWidth / 2, 230, { align: 'center' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(14);
      doc.setTextColor(90, 90, 110);
      doc.text('for successfully completing', pageWidth / 2, 270, { align: 'center' });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.setTextColor(40, 40, 60);
      doc.text(title, pageWidth / 2, 310, { align: 'center', maxWidth: pageWidth - 160 });

      const verifyUrl = `${window.location.origin}/verify-certificate/${cert.verification_code}`;
      doc.setFontSize(11);
      doc.setTextColor(120, 120, 140);
      doc.text(`Verification code: ${cert.verification_code}`, pageWidth / 2, 380, { align: 'center' });
      doc.text(`Verify at: ${verifyUrl}`, pageWidth / 2, 400, { align: 'center' });

      doc.setFontSize(11);
      doc.text(`Issued: ${new Date(cert.issued_at).toLocaleDateString()}`, 80, pageHeight - 80);

      doc.save(`certificate-${cert.verification_code}.pdf`);
    } catch (err) {
      logger.error('PDF download failed', err);
      toast({ title: 'Download failed', description: 'Could not generate the PDF.', variant: 'destructive' });
    } finally {
      setDownloadingId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3" data-testid="certificates-loading">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (certificates.length === 0) {
    return (
      <Alert data-testid="certificates-empty">
        <Award className="h-4 w-4" />
        <AlertDescription>
          You haven't earned any certificates yet. Complete a course to receive one automatically.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <ul className="divide-y" data-testid="certificates-list">
      {certificates.map((cert) => {
        const title = cert.certificate_data?.course_title || cert.course?.title || 'Course';
        return (
          <li key={cert.id} className="py-4 flex flex-wrap items-start gap-4" data-testid="certificate-row">
            <div className="rounded-md bg-primary/10 p-3 text-primary">
              <Award className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold text-base truncate">{title}</h3>
                <Badge variant="secondary" className="capitalize">{cert.certificate_type}</Badge>
                <Badge variant="outline" className="gap-1 text-xs">
                  <ShieldCheck className="h-3 w-3" /> Verified
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Issued {new Date(cert.issued_at).toLocaleDateString()} · Study time {formatTime(cert.certificate_data?.time_spent)}
              </p>
              <p className="text-xs font-mono text-muted-foreground break-all">
                Code: {cert.verification_code}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDownload(cert)}
                disabled={downloadingId === cert.id}
                data-testid="certificate-download"
              >
                <Download className="h-4 w-4 mr-1" />
                {downloadingId === cert.id ? 'Preparing…' : 'Download PDF'}
              </Button>
              <Button variant="ghost" size="sm" asChild data-testid="certificate-verify-link">
                <Link to={`/verify-certificate/${cert.verification_code}`} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-1" /> Verify
                </Link>
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
};

export default MyCertificates;
