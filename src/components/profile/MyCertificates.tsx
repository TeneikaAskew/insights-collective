// ABOUTME: Renders the list of certificates the signed-in user has earned across
// ABOUTME: every course, with download-as-PDF and public verification-link actions.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Award, Download, ExternalLink, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { deliverBlob } from '@/lib/downloadFile';
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  /**
   * jsPDF, fetched before anybody clicks.
   *
   * This is the whole reason "Download PDF" appeared to do nothing on a phone.
   * The handler used to `await import('jspdf')` on click, and that import is a
   * ~460 kB chunk — seconds on a mobile connection. A browser only honours a
   * programmatic download while the user-activation token from the tap is still
   * live, and that token does not survive a network round trip of that length.
   * The download was then discarded with no error to catch and nothing to
   * toast: the button genuinely did nothing.
   *
   * Starting the fetch when the list renders means the click resolves an
   * already-settled promise instead, which keeps the activation intact.
   */
  const pdfModule = useRef<Promise<typeof import('jspdf')> | null>(null);
  const [pdfReady, setPdfReady] = useState(false);
  const preloadPdfLibrary = useCallback(() => {
    if (!pdfModule.current) {
      pdfModule.current = import('jspdf');
      void pdfModule.current.then(
        () => setPdfReady(true),
        () => {
          // Let the next attempt retry rather than pinning a rejected promise
          // that every later click would re-await and re-fail.
          pdfModule.current = null;
        },
      );
    }
    return pdfModule.current;
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    const load = async () => {
      setLoading(true);
      setLoadError(null);
      const { data, error } = await supabase
        .from('certificates')
        .select('id, course_id, certificate_type, issued_at, verification_code, certificate_data, course:courses(title, category, level, duration)')
        .eq('user_id', user.id)
        .order('issued_at', { ascending: false });
      if (error) {
        // A failed fetch must not tell the user they have no certificates.
        logger.error('Failed to load certificates', error);
        setLoadError(error.message || 'Failed to load certificates');
      } else {
        setCertificates((data as any) || []);
      }
      setLoading(false);
    };
    load();
  }, [user?.id, reloadKey]);

  // Warm the PDF library once there is something to download. Deliberately not
  // on mount: someone with no certificates should never pay for a 460 kB chunk
  // they have no use for.
  useEffect(() => {
    if (certificates.length > 0) void preloadPdfLibrary();
  }, [certificates.length, preloadPdfLibrary]);

  const handleDownload = async (cert: CertificateRow) => {
    setDownloadingId(cert.id);
    try {
      const { jsPDF } = await preloadPdfLibrary();
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

      // Not `doc.save()`. That builds an anchor and clicks it, which an iframe
      // without `allow-downloads` — the preview this app is often read inside —
      // ignores without raising anything. deliverBlob opens the PDF in a tab
      // where a download cannot land, so the file always arrives somehow, and
      // reports which route it took so the reader is told where to look.
      const method = deliverBlob(
        doc.output('blob'),
        `certificate-${cert.verification_code}.pdf`,
      );

      if (method === 'new-tab') {
        toast({
          title: 'Certificate opened in a new tab',
          description: 'Your browser blocks direct downloads here — save or share it from the tab that just opened.',
        });
      }
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

  if (loadError) {
    return (
      <Alert variant="destructive" role="alert" data-testid="certificates-error">
        <Award className="h-4 w-4" />
        <AlertDescription className="flex flex-col gap-3">
          <span>Failed to load your certificates: {loadError}</span>
          <Button variant="outline" size="sm" className="w-fit" onClick={() => setReloadKey((k) => k + 1)}>
            Retry
          </Button>
        </AlertDescription>
      </Alert>
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
          // `flex flex-wrap` with a `flex-1 min-w-0` text column never actually
          // wrapped: wrapping is a last resort, and min-w-0 told the browser the
          // column could shrink indefinitely, so on a phone it kept the buttons
          // alongside and squeezed the text to roughly one character wide — the
          // title clipped to a single letter and the verification code ran down
          // the screen a character per line. Stack explicitly below `sm`
          // instead, and only lay the row out horizontally where there is room.
          <li
            key={cert.id}
            className="py-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4"
            data-testid="certificate-row"
          >
            <div className="flex items-start gap-3 min-w-0 sm:flex-1">
              <div className="shrink-0 rounded-md bg-primary/10 p-3 text-primary">
                <Award className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  {/* break-words, not truncate: the row is no longer starved of
                      width, so a long course title should wrap and stay
                      readable rather than lose its ending to an ellipsis. */}
                  <h3 className="font-semibold text-base min-w-0 break-words">{title}</h3>
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
            </div>
            <div className="flex flex-wrap gap-2 sm:shrink-0">
              {/* Held disabled until the library has actually arrived.
                  Enabling it the moment the row renders reintroduced the bug on
                  a slow connection: the tap would await an in-flight fetch and
                  lose the activation exactly as before. Starting that fetch a
                  few milliseconds earlier on pointerdown does not change this —
                  only waiting for it to settle does. "Preparing…" is also the
                  honest label, because the action genuinely is not ready. */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDownload(cert)}
                onPointerDown={preloadPdfLibrary}
                disabled={!pdfReady || downloadingId === cert.id}
                data-testid="certificate-download"
              >
                <Download className="h-4 w-4 mr-1" />
                {!pdfReady || downloadingId === cert.id ? 'Preparing…' : 'Download PDF'}
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
