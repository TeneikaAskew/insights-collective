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

import { createLogger } from '@/utils/logger';

const logger = createLogger('getCertificateIcon');

interface Certificate {
  id: string;
  user_id: string;
  course_id: string;
  certificate_type: 'completion' | 'achievement' | 'mastery';
  issued_at: string;
  certificate_data: {
    course_title: string;
    completion_percentage: number;
    final_score?: number;
    time_spent: number;
    achievements: string[];
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

      // Fetch course info
      const { data: courseData } = await supabase
        .from('courses')
        .select('*')
        .eq('id', courseId)
        .single();

      setCourse(courseData);

      if (mode === 'verify' && verificationCode) {
        // Verify certificate
        const { data: certData } = await supabase
          .from('certificates')
          .select(`
            *,
            user_profile:profiles!user_id(first_name, last_name)
          `)
          .eq('verification_code', verificationCode)
          .single();

        if (certData) {
          setCertificates([certData]);
        }
      } else {
        // Fetch certificates for user
        const targetUserId = userId || user?.id;
        if (targetUserId) {
          const { data: certData } = await supabase
            .from('certificates')
            .select('*')
            .eq('user_id', targetUserId)
            .eq('course_id', courseId)
            .order('issued_at', { ascending: false });

          setCertificates(certData || []);
        }
      }

    } catch (error) {
      logger.error('Error fetching certificate data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load certificate data',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

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
      // Generate verification code
      const verificationCode = `CERT-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

      // Determine certificate type based on performance
      let certificateType: 'completion' | 'achievement' | 'mastery' = 'completion';
      if (courseProgress.overall_completion === 100) {
        certificateType = courseProgress.total_time_spent > 3600 ? 'achievement' : 'mastery'; // More than 1 hour = achievement
      }

      const certificateData = {
        user_id: user.id,
        course_id: courseId,
        certificate_type: certificateType,
        certificate_data: {
          course_title: course.title,
          completion_percentage: courseProgress.overall_completion,
          time_spent: courseProgress.total_time_spent,
          achievements: [
            'Completed all course modules',
            'Demonstrated practical skills',
            'Engaged with course materials'
          ]
        },
        verification_code: verificationCode
      };

      const { data, error } = await supabase
        .from('certificates')
        .insert(certificateData)
        .select()
        .single();

      if (error) throw error;

      setCertificates(prev => [data, ...prev]);

      toast({
        title: 'Certificate Generated!',
        description: 'Your certificate has been generated successfully',
      });

    } catch (error) {
      logger.error('Error generating certificate:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate certificate',
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
      doc.text(certificate.certificate_data.course_title, pageWidth / 2, 310, { align: 'center', maxWidth: pageWidth - 160 });

      // Stats
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(12);
      doc.setTextColor(90, 90, 110);
      doc.text(
        `Completion: ${certificate.certificate_data.completion_percentage}%   |   Study time: ${formatTime(certificate.certificate_data.time_spent)}`,
        pageWidth / 2,
        360,
        { align: 'center' },
      );

      // Footer
      const issued = new Date(certificate.issued_at).toLocaleDateString();
      doc.setFontSize(11);
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
        return <Star className="h-6 w-6 text-yellow-500" />;
      case 'achievement':
        return <Award className="h-6 w-6 text-blue-500" />;
      default:
        return <GraduationCap className="h-6 w-6 text-green-500" />;
    }
  };

  const getCertificateColor = (type: string) => {
    switch (type) {
      case 'mastery':
        return 'border-yellow-200 bg-yellow-50';
      case 'achievement':
        return 'border-blue-200 bg-blue-50';
      default:
        return 'border-green-200 bg-green-50';
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
            <div className="h-4 bg-gray-200 rounded w-1/3"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
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
            <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
              <GraduationCap className="h-8 w-8 text-blue-600" />
            </div>
            
            <div>
              <h3 className="text-xl font-semibold mb-2">
                {course?.title} Certification
              </h3>
              <p className="text-gray-600">
                Complete the course to earn your certificate
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="text-center">
                  <div className="font-semibold text-lg">
                    {courseProgress.overall_completion}%
                  </div>
                  <div className="text-gray-600">Completed</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold text-lg">
                    {formatTime(courseProgress.total_time_spent)}
                  </div>
                  <div className="text-gray-600">Time Spent</div>
                </div>
              </div>
            </div>

            {courseProgress.overall_completion === 100 ? (
              certificates.length > 0 ? (
                <div className="space-y-2">
                  <CheckCircle className="h-8 w-8 text-green-600 mx-auto" />
                  <p className="text-green-600 font-medium">
                    Certificate already issued!
                  </p>
                </div>
              ) : (
                <Button 
                  onClick={generateCertificate}
                  disabled={generating}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Award className="h-4 w-4 mr-2" />
                  {generating ? 'Generating...' : 'Generate Certificate'}
                </Button>
              )
            ) : (
              <div className="space-y-2">
                <Clock className="h-8 w-8 text-yellow-600 mx-auto" />
                <p className="text-yellow-600 font-medium">
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
              <Award className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">
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
                            {certificate.certificate_data.course_title}
                          </h4>
                          <Badge variant="secondary">
                            {certificate.certificate_type.charAt(0).toUpperCase() + 
                             certificate.certificate_type.slice(1)} Certificate
                          </Badge>
                        </div>
                      </div>
                      <div className="text-right text-sm text-gray-600">
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
                        <div className="font-semibold text-lg text-green-600">
                          {certificate.certificate_data.completion_percentage}%
                        </div>
                        <div className="text-gray-600">Completion</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold text-lg text-blue-600">
                          {formatTime(certificate.certificate_data.time_spent)}
                        </div>
                        <div className="text-gray-600">Study Time</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold text-lg text-purple-600">
                          {certificate.certificate_data.achievements?.length || 0}
                        </div>
                        <div className="text-gray-600">Achievements</div>
                      </div>
                    </div>

                    <div className="border-t pt-4">
                      <div className="text-sm text-gray-600 mb-2">
                        Verification Code: 
                        <code className="ml-2 bg-gray-100 px-2 py-1 rounded text-xs">
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