
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/hooks/use-user';
import { supabase } from '@/integrations/supabase/client';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { format } from 'date-fns';
import { Video, VideoOff, Mic, MicOff, Phone, Clock, ChevronLeft } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';

import { createLogger } from '@/utils/logger';

const logger = createLogger('MockInterviewRoom');

interface MockSession {
  id: string;
  user1_id: string;
  user2_id: string;
  role1: 'interviewer' | 'interviewee';
  role2: 'interviewer' | 'interviewee';
  session_time: string;
  type: 'behavioral' | 'technical';
  status: 'scheduled' | 'completed' | 'canceled';
  study_guide_id: string | null;
  meeting_url?: string | null;
  video_platform?: string | null;
}

// Matches the scheduler's fallback so older sessions booked before meeting
// links existed still have somewhere to meet.
const jitsiRoomUrl = (sessionId: string) => `https://meet.jit.si/insights-mock-${sessionId}`;

const formatCountdown = (totalSeconds: number): string => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

export default function MockInterviewRoom() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useUser();
  const [session, setSession] = useState<MockSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [remainingTime, setRemainingTime] = useState<number | null>(null);
  const [reviewScores, setReviewScores] = useState({
    communication: 5,
    technical_knowledge: 5,
    problem_solving: 5,
    overall_impression: 5,
  });
  const [reviewNotes, setReviewNotes] = useState('');
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    loadSession();
    setupWebRTC();
    return () => {
      // Cleanup WebRTC
      cleanupWebRTC();
    };
  }, []);

  // Tick the countdown once per second until the session starts
  useEffect(() => {
    if (remainingTime === null || remainingTime <= 0) return;
    const timer = setTimeout(() => setRemainingTime(remainingTime - 1), 1000);
    return () => clearTimeout(timer);
  }, [remainingTime]);

  const loadSession = async () => {
    // App.tsx routes both /mock-interview-room and /mock-interview-room/:sessionId
    // here, so sessionId is genuinely absent on the first. Without this guard the
    // id went into the filter as the literal string "undefined", Postgres
    // rejected it with 22P02, and the page showed "Failed to load interview
    // session" — a database error standing in for "no session was chosen".
    if (!sessionId) {
      navigate('/interview-prep/mock-interviews');
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('mock_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (error) throw error;

      setSession(data as unknown as MockSession);
      const sessionTime = new Date(data.session_time);
      const now = new Date();
      const timeDiff = Math.floor((sessionTime.getTime() - now.getTime()) / 1000);
      setRemainingTime(timeDiff > 0 ? timeDiff : 0);
    } catch (error) {
      logger.error('Error loading session:', error);
      toast({
        title: 'Error',
        description: 'Failed to load interview session',
        variant: 'destructive',
      });
      navigate('/interview-prep/mock-interviews');
    } finally {
      setIsLoading(false);
    }
  };

  const setupWebRTC = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // TODO: Implement WebRTC peer connection
      // This is a placeholder for the actual WebRTC implementation
      // You would need to:
      // 1. Create RTCPeerConnection
      // 2. Add local stream tracks
      // 3. Create and exchange offer/answer
      // 4. Handle ICE candidates
      // 5. Set up data channel if needed
    } catch (error) {
      logger.error('Error accessing media devices:', error);
      toast({
        title: 'Media Access Error',
        description: 'Failed to access camera or microphone',
        variant: 'destructive',
      });
    }
  };

  const cleanupWebRTC = () => {
    // Stop all tracks
    if (localVideoRef.current?.srcObject) {
      const stream = localVideoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
    if (remoteVideoRef.current?.srcObject) {
      const stream = remoteVideoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
  };

  const toggleVideo = () => {
    if (localVideoRef.current?.srcObject) {
      const stream = localVideoRef.current.srcObject as MediaStream;
      stream.getVideoTracks().forEach(track => {
        track.enabled = !isVideoEnabled;
      });
      setIsVideoEnabled(!isVideoEnabled);
    }
  };

  const toggleAudio = () => {
    if (localVideoRef.current?.srcObject) {
      const stream = localVideoRef.current.srcObject as MediaStream;
      stream.getAudioTracks().forEach(track => {
        track.enabled = !isAudioEnabled;
      });
      setIsAudioEnabled(!isAudioEnabled);
    }
  };

  const endSession = async () => {
    if (!window.confirm('End this session for both participants?')) return;

    try {
      const { error } = await supabase
        .from('mock_sessions')
        .update({ status: 'completed' })
        .eq('id', sessionId);

      if (error) throw error;

      // Submit review if you're the interviewer
      if (
        (session?.user1_id === user?.id && session?.role1 === 'interviewer') ||
        (session?.user2_id === user?.id && session?.role2 === 'interviewer')
      ) {
        const { error: reviewError } = await supabase
          .from('peer_reviews')
          .insert({
            session_id: sessionId,
            reviewer_id: user?.id,
            reviewee_id: session?.user1_id === user?.id ? session?.user2_id : session?.user1_id,
            rubric_scores: reviewScores,
            notes: reviewNotes,
          });

        if (reviewError) throw reviewError;
      }

      cleanupWebRTC();
      navigate('/interview-prep/mock-interviews');
      toast({
        title: 'Session Ended',
        description: 'The mock interview session has been completed',
      });
    } catch (error) {
      logger.error('Error ending session:', error);
      toast({
        title: 'Error',
        description: 'Failed to end the session',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <AppLayout fullWidth>
        <div className="ss-wash min-h-full px-4 sm:px-6 py-8">
          <div className="mx-auto max-w-7xl">
            <Card className="ss-card">
              <CardContent className="flex items-center justify-center py-12">
                <Spinner size="lg" />
              </CardContent>
            </Card>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!session) {
    return (
      <AppLayout fullWidth>
        <div className="ss-wash min-h-full px-4 sm:px-6 py-8">
          <div className="mx-auto max-w-7xl">
            <Card className="ss-card">
              <CardContent className="py-10 text-center">
                <p className="font-medium text-ss-bad">Session not found</p>
                <Button
                  onClick={() => navigate('/interview-prep/mock-interviews')}
                  variant="outline"
                  className="mt-4 rounded-full font-bold"
                >
                  Return to Mock Interviews
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </AppLayout>
    );
  }

  const isInterviewer =
    (session.user1_id === user?.id && session.role1 === 'interviewer') ||
    (session.user2_id === user?.id && session.role2 === 'interviewer');

  const evaluationCriteria: { key: keyof typeof reviewScores; label: string }[] = [
    { key: 'communication', label: 'Communication' },
    { key: 'technical_knowledge', label: 'Technical Knowledge' },
    { key: 'problem_solving', label: 'Problem Solving' },
    { key: 'overall_impression', label: 'Overall Impression' },
  ];

  const videoStage = (
    <div className="overflow-hidden rounded-[26px] border border-[#3A3644] bg-[#242130] shadow-[0_14px_34px_-18px_rgba(90,80,120,0.55)]">
      <div className="p-4 sm:p-5">
        <div className="relative aspect-video overflow-hidden rounded-2xl bg-[#000000]">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="h-full w-full object-cover"
          />
          {/* Self view, picture-in-picture */}
          <div className="absolute bottom-3 right-3 w-1/4 overflow-hidden rounded-xl border-2 border-white/40 bg-[#000000] shadow-lg">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="aspect-video h-full w-full object-cover"
            />
            <span className="absolute bottom-1 left-1.5 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-bold text-white">
              You
            </span>
          </div>
        </div>
        <p className="mt-3 text-center text-xs text-[#9CA3AF]">
          Camera check — the interview itself runs on{' '}
          {session.video_platform || 'your meeting link'}. Use Join video call below.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-3 border-t border-[#3A3644] px-5 py-4">
        <Button
          onClick={() => window.open(session.meeting_url || jitsiRoomUrl(session.id), '_blank', 'noopener')}
          className="rounded-full font-bold"
        >
          <Video className="h-4 w-4 mr-2" />
          Join video call
        </Button>
        <Button
          variant="outline"
          onClick={toggleVideo}
          aria-label={isVideoEnabled ? 'Turn camera off' : 'Turn camera on'}
          className="rounded-full font-bold border-[#4A445C] bg-transparent text-[#D1D5DB] hover:bg-[#333333] hover:text-white"
        >
          {isVideoEnabled ? <Video className="h-4 w-4 mr-2" /> : <VideoOff className="h-4 w-4 mr-2" />}
          Camera
        </Button>
        <Button
          variant="outline"
          onClick={toggleAudio}
          aria-label={isAudioEnabled ? 'Mute microphone' : 'Unmute microphone'}
          className="rounded-full font-bold border-[#4A445C] bg-transparent text-[#D1D5DB] hover:bg-[#333333] hover:text-white"
        >
          {isAudioEnabled ? <Mic className="h-4 w-4 mr-2" /> : <MicOff className="h-4 w-4 mr-2" />}
          Mic
        </Button>
        <Button
          variant="destructive"
          onClick={endSession}
          className="rounded-full font-bold"
        >
          <Phone className="h-4 w-4 mr-2" />
          End Session
        </Button>
      </div>
    </div>
  );

  const questionsCard = (
    <Card className="ss-card">
      <CardHeader>
        <CardTitle>Interview Questions</CardTitle>
        <CardDescription>
          Suggested questions based on the selected interview type.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {(session.type === 'behavioral'
            ? [
                'Tell me about a challenging project you worked on.',
                'How do you handle conflicts in a team?',
                'Describe a situation where you had to learn something quickly.',
              ]
            : [
                'Explain the concept of object-oriented programming.',
                'What are the differences between arrays and linked lists?',
                'How would you optimize a slow database query?',
              ]
          ).map((question) => (
            <li
              key={question}
              className="rounded-xl border-l-4 border-l-ss-lav bg-ss-lav-chip px-4 py-3 text-sm"
            >
              {question}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );

  return (
    <AppLayout fullWidth>
      <div className="ss-wash min-h-full px-4 sm:px-6 py-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/interview-prep/mock-interviews')}
                className="rounded-full font-bold"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Mock Interviews
              </Button>
            </div>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="text-3xl sm:text-4xl font-bold mb-2">
                  {session.type === 'behavioral' ? 'Behavioral' : 'Technical'} Interview
                </h1>
                <p className="text-muted-foreground text-lg">
                  {format(new Date(session.session_time), 'PPP p')}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                    remainingTime ? 'bg-ss-warn-chip text-ss-warn' : 'bg-ss-good-chip text-ss-good'
                  }`}
                >
                  <Clock className="h-3.5 w-3.5" />
                  {remainingTime ? `Starts in ${formatCountdown(remainingTime)}` : 'In Progress'}
                </span>
                <span className="rounded-full bg-ss-lav-chip px-3 py-1 text-xs font-bold text-ss-lav-deep">
                  {isInterviewer ? 'Interviewer' : 'Interviewee'}
                </span>
              </div>
            </div>
          </div>

          {isInterviewer ? (
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
              <div className="lg:col-span-3 space-y-6">
                {videoStage}
                {questionsCard}
              </div>

              <Card className="ss-card bg-ss-card-warm lg:col-span-2 lg:sticky lg:top-6">
                <CardHeader>
                  <CardTitle>Evaluation Form</CardTitle>
                  <CardDescription>
                    Rate the candidate's performance and provide feedback.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    {evaluationCriteria.map(({ key, label }) => (
                      <div key={key} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-medium">{label}</label>
                          <span className="rounded-full bg-ss-lav-chip px-2.5 py-0.5 text-sm font-bold text-ss-lav-deep tabular-nums">
                            {reviewScores[key]}/10
                          </span>
                        </div>
                        <Slider
                          value={[reviewScores[key]]}
                          min={1}
                          max={10}
                          step={1}
                          onValueChange={([value]) =>
                            setReviewScores(prev => ({ ...prev, [key]: value }))
                          }
                        />
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Feedback Notes</label>
                    <Textarea
                      placeholder="Provide detailed feedback about the candidate's performance..."
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      className="min-h-[200px] rounded-xl bg-card"
                    />
                    <p className="text-xs text-muted-foreground">
                      Your review is saved when you end the session.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="mx-auto max-w-4xl">{videoStage}</div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
