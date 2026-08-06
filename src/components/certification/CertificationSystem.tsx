import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Award, 
  Download, 
  Calendar, 
  CheckCircle, 
  Clock,
  Share2,
  Star,
  GraduationCap
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useProgressTracking } from '@/hooks/useProgressTracking';
import CourseErrorState from '@/components/course/CourseErrorState';

import { createLogger } from '@/utils/logger';

const logger = createLogger('getCertificateIcon');

interface Certificate {
  id: string;
  user_id: string;
  course_id: string;
  certificate_type: 'completion' | 'achievement' | 'mastery';
  issued_at: string;
  // certificate_data shape varies: the DB auto-issue trigger writes only
  // { completion_percentage, total_items, auto_issued }, while manual/legacy
  // issuance may include course_title, time_spent, achievements, final_score.
  // All fields are optional here so callers must apply fallbacks.
  certificate_data: {
    course_title?: string;
    completion_percentage?: number;
    final_score?: number;
    time_spent?: number;
    achievements?: string[];
    total_items?: number;
    auto_issued?: boolean;
  };
  verification_code: string;
}

interface CertificationSystemProps {
  courseId: string;
  userId?: string;
  mode: 'issue' | 'view' | 'verify';
  verificationCode?: string;
}

const CertificationSystem: React.FC<CertificationSystemProps> = ({
  courseId,
  userId,
  mode,
  verificationCode
}) => {
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<unknown>(null);
  const [generating, setGenerating] = useState(false);
  const [course, setCourse] = useState<any>(null);
  
  const { user } = useAuth();
  const { toast } = useToast();
  const { courseProgress } = useProgressTracking(courseId);

  useEffect(() => {
    fetchData();
  }, [courseId, userId, verificationCode]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setFetchError(null);

      // Fetch course info. maybeSingle so a missing course row is not an
      // error — only a genuine query failure throws.
      const { data: courseData, error: courseError } = await supabase
        .from('courses')
        .select('*')
        .eq('id', courseId)
        .maybeSingle();

      if (courseError) throw courseError;
      setCourse(courseData);

      if (mode === 'verify' && verificationCode) {
        // Verify certificate. maybeSingle distinguishes "query succeeded but
        // no certificate matches this code" (data: null, no error) from a
        // database/network failure (error set). Only the former may be shown
        // as "Invalid verification code" — a failure must never be presented
        // as a verification verdict.
        const { data: certData, error: certError } = await supabase
          .from('certificates')
          .select(`
            *,
            user_profile:profiles!user_id(first_name, last_name)
          `)
          .eq('verification_code', verificationCode)
          .maybeSingle();

        if (certError) throw certError;
        setCertificates(certData ? [certData as unknown as Certificate] : []);
      } else {
        // Fetch certificates for user
        const targetUserId = userId || user?.id;
        if (targetUserId) {
          const { data: certData, error: certError } = await supabase
            .from('certificates')
            .select('*')
            .eq('user_id', targetUserId)
            .eq('course_id', courseId)
            .order('issued_at', { ascending: false });

          if (certError) throw certError;
          setCertificates((certData || []) as unknown as Certificate[]);
        }
      }

    } catch (error) {
      logger.error('Error fetching certificate data:', error);
      setFetchError(error);
      toast({
        title: 'Error',
        description: 'Failed to load certificate data',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // Certificates are issued server-side by the auto_issue_certificate_on_progression
  // trigger when every published content item is completed. Students cannot INSERT
  // into public.certificates directly (RLS restricts inserts to the course
  // instructor or admins), so this button just gives the trigger a chance to fire
  // by re-checking completion and re-fetching. If nothing shows up, we surface a
  // clear reason instead of a generic RLS error.
  const generateCertificate = async () => {
    if (!user || !courseProgress || !course) return;

    if (courseProgress.overall_completion < 100) {
      toast({
        title: 'Course Not Complete',
        description: 'You must complete the entire course to earn a certificate',
        variant: 'destructive'
      });
      return;
    }

    setGenerating(true);
    try {
      // Ask the DB whether it considers the course complete (this matches the
      // trigger's own definition — published content_items only).
      const { data: isComplete, error: rpcError } = await supabase.rpc(
        'check_course_completion',
        // The DB function signature is (p_course_id, p_student_id) — passing
        // p_user_id made every call fail with "function does not exist".
        { p_course_id: courseId, p_student_id: user.id }
      );
      if (rpcError) throw rpcError;

      // Give the trigger a beat if it's firing from a very recent progression.
      await new Promise((resolve) => setTimeout(resolve, 500));

      const { data: certData, error: certError } = await supabase
        .from('certificates')
        .select('*')
        .eq('user_id', user.id)
        .eq('course_id', courseId)
        .order('issued_at', { ascending: false });
      if (certError) throw certError;

      if (certData && certData.length > 0) {
        setCertificates(certData as unknown as Certificate[]);
        toast({
          title: 'Certificate Ready',
          description: 'Your certificate has been issued.',
        });
      } else if (!isComplete) {
        toast({
          title: 'Not quite there yet',
          description:
            "Your progress hasn't been fully recorded. Finish any remaining lessons or assignments, then try again.",
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Almost there',
          description:
            'Course marked complete but the certificate is still being issued. Please refresh in a moment.',
        });
      }
    } catch (error) {
      logger.error('Error refreshing certificate:', error);
      toast({
        title: 'Error',
        description: 'Failed to load your certificate. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setGenerating(false);
    }
  };

  const downloadCertificate = async (certificate: Certificate) => {
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      // Border
      doc.setDrawColor(120, 90, 200);
      doc.setLineWidth(6);
      doc.rect(24, 24, pageWidth - 48, pageHeight - 48);
      doc.setLineWidth(1);
      doc.rect(36, 36, pageWidth - 72, pageHeight - 72);

      // Header
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(34);
      doc.setTextColor(40, 40, 60);
      doc.text('Certificate of ' + certificate.certificate_type.replace(/^./, (c) => c.toUpperCase()), pageWidth / 2, 130, { align: 'center' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(14);
      doc.setTextColor(90, 90, 110);
      doc.text('This certificate is proudly presented to', pageWidth / 2, 180, { align: 'center' });

      // Recipient
      const recipient = user?.user_metadata?.full_name || user?.email || 'Student';
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(28);
      doc.setTextColor(40, 40, 60);
      doc.text(recipient, pageWidth / 2, 230, { align: 'center' });

      // Course
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(14);
      doc.setTextColor(90, 90, 110);
      doc.text('for successfully completing the course', pageWidth / 2, 270, { align: 'center' });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.setTextColor(40, 40, 60);
      doc.text(certificate.certificate_data.course_title || course?.title || 'Course', pageWidth / 2, 310, { align: 'center', maxWidth: pageWidth - 160 });

      // Course details
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(12);
      doc.setTextColor(90, 90, 110);
      const detailParts = [
        course?.category ? `Category: ${course.category}` : null,
        course?.level ? `Level: ${course.level}` : null,
        course?.duration ? `Duration: ${course.duration}` : null,
      ].filter(Boolean).join('   |   ');
      if (detailParts) {
        doc.text(detailParts, pageWidth / 2, 350, { align: 'center' });
      }
      const completionPct = certificate.certificate_data.completion_percentage ?? 100;
      const timeSpent = certificate.certificate_data.time_spent;
      const timeText = typeof timeSpent === 'number' && timeSpent > 0 ? `   |   Study time: ${formatTime(timeSpent)}` : '';
      doc.text(
        `Completion: ${completionPct}%${timeText}`,
        pageWidth / 2,
        375,
        { align: 'center' },
      );

      // Verification link
      const verifyUrl = `${window.location.origin}/verify-certificate/${certificate.verification_code}`;
      doc.setFontSize(10);
      doc.setTextColor(120, 120, 140);
      doc.text(`Verify at: ${verifyUrl}`, pageWidth / 2, 415, { align: 'center' });

      // Footer
      const issued = new Date(certificate.issued_at).toLocaleDateString();
      doc.setFontSize(11);
      doc.setTextColor(90, 90, 110);
      doc.text(`Issued: ${issued}`, 80, pageHeight - 80);
      doc.text(`Verification: ${certificate.verification_code}`, pageWidth - 80, pageHeight - 80, { align: 'right' });

      doc.save(`certificate-${certificate.verification_code}.pdf`);

      toast({
        title: 'Certificate Downloaded',
        description: 'Your PDF certificate has been downloaded.',
      });
    } catch (error) {
      logger.error('Error downloading certificate:', error);
      toast({
        title: 'Error',
        description: 'Failed to download certificate',
        variant: 'destructive',
      });
    }
  };

  const shareCertificate = async (certificate: Certificate) => {
    const shareUrl = `${window.location.origin}/verify-certificate/${certificate.verification_code}`;
    
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast({
        title: 'Link Copied',
        description: 'Certificate verification link copied to clipboard'
      });
    } catch (error) {
      toast({
        title: 'Share Failed',
        description: 'Could not copy link to clipboard',
        variant: 'destructive'
      });
    }
  };

  const getCertificateIcon = (type: string) => {
    switch (type) {
      case 'mastery':
        return <Star className="h-6 w-6 text-ss-warn" />;
      case 'achievement':
        return <Award className="h-6 w-6 text-primary" />;
      default:
        return <GraduationCap className="h-6 w-6 text-ss-good" />;
    }
  };

  const getCertificateColor = (type: string) => {
    switch (type) {
      case 'mastery':
        return 'bg-ss-warn-chip';
      case 'achievement':
        return 'bg-accent';
      default:
        return 'bg-ss-good-chip';
    }
  };

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/3"></div>
            <div className="h-32 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // A failed fetch must never masquerade as a real result — in verify mode
  // especially, an outage must not be presented as "Invalid verification code".
  if (fetchError) {
    return (
      <CourseErrorState
        title={mode === 'verify' ? 'Verification failed — please try again' : 'Failed to load certificate data'}
        error={
          mode === 'verify'
            ? 'We could not check this verification code because the verification service is unavailable. This does not mean the certificate is invalid.'
            : 'Your certificates could not be loaded right now.'
        }
        onRetry={fetchData}
      />
    );
  }

  if (mode === 'issue' && courseProgress) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Award className="h-5 w-5" />
            <span>Course Certification</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-accent rounded-full flex items-center justify-center">
              <GraduationCap className="h-8 w-8 text-primary" />
            </div>
            
            <div>
              <h3 className="text-xl font-semibold mb-2">
                {course?.title} Certification
              </h3>
              <p className="text-muted-foreground">
                Complete the course to earn your certificate
              </p>
            </div>

            <div className="bg-muted rounded-lg p-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="text-center">
                  <div className="font-semibold text-lg">
                    {courseProgress.overall_completion}%
                  </div>
                  <div className="text-muted-foreground">Completed</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold text-lg">
                    {formatTime(courseProgress.total_time_spent)}
                  </div>
                  <div className="text-muted-foreground">Time Spent</div>
                </div>
              </div>
            </div>

            {courseProgress.overall_completion === 100 ? (
              certificates.length > 0 ? (
                <div className="space-y-2">
                  <CheckCircle className="h-8 w-8 text-ss-good mx-auto" />
                  <p className="text-ss-good font-medium">
                    Certificate already issued!
                  </p>
                </div>
              ) : (
                <Button 
                  onClick={generateCertificate}
                  disabled={generating}
                  className="bg-ss-good hover:bg-ss-good/90"
                >
                  <Award className="h-4 w-4 mr-2" />
                  {generating ? 'Checking...' : 'View my certificate'}
                </Button>
              )
            ) : (
              <div className="space-y-2">
                <Clock className="h-8 w-8 text-ss-warn mx-auto" />
                <p className="text-ss-warn font-medium">
                  Complete the course to unlock certification
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Award className="h-5 w-5" />
            <span>
              {mode === 'verify' ? 'Certificate Verification' : 'Your Certificates'}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {certificates.length === 0 ? (
            <div className="text-center py-8">
              <Award className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {mode === 'verify' ? 'Invalid verification code' : 'No certificates earned yet'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {certificates.map(certificate => (
                <Card key={certificate.id} className={getCertificateColor(certificate.certificate_type)}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        {getCertificateIcon(certificate.certificate_type)}
                        <div>
                          <h4 className="font-semibold">
                            {certificate.certificate_data.course_title || course?.title || 'Course Certificate'}
                          </h4>
                          <Badge variant="secondary">
                            {certificate.certificate_type.charAt(0).toUpperCase() + 
                             certificate.certificate_type.slice(1)} Certificate
                          </Badge>
                        </div>
                      </div>
                      <div className="text-right text-sm text-muted-foreground">
                        <div className="flex items-center space-x-1">
                          <Calendar className="h-4 w-4" />
                          <span>{new Date(certificate.issued_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                      <div className="text-center">
                        <div className="font-semibold text-lg text-ss-good">
                          {certificate.certificate_data.completion_percentage ?? 100}%
                        </div>
                        <div className="text-muted-foreground">Completion</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold text-lg text-ss-teal">
                          {typeof certificate.certificate_data.time_spent === 'number' && certificate.certificate_data.time_spent > 0
                            ? formatTime(certificate.certificate_data.time_spent)
                            : '—'}
                        </div>
                        <div className="text-muted-foreground">Study Time</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold text-lg text-primary">
                          {certificate.certificate_data.achievements?.length ?? certificate.certificate_data.total_items ?? 0}
                        </div>
                        <div className="text-muted-foreground">
                          {certificate.certificate_data.achievements?.length ? 'Achievements' : 'Items Completed'}
                        </div>
                      </div>
                    </div>

                    <div className="border-t pt-4">
                      <div className="text-sm text-muted-foreground mb-2">
                        Verification Code: 
                        <code className="ml-2 bg-muted px-2 py-1 rounded text-xs">
                          {certificate.verification_code}
                        </code>
                      </div>
                    </div>

                    {mode !== 'verify' && (
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => downloadCertificate(certificate)}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => shareCertificate(certificate)}
                        >
                          <Share2 className="h-4 w-4 mr-2" />
                          Share
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CertificationSystem;