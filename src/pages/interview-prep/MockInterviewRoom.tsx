
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/hooks/use-user';
import { supabase } from '@/integrations/supabase/client';
import { Spinner } from '@/components/ui/spinner';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { format } from 'date-fns';
import { Video, VideoOff, Mic, MicOff, Phone, Clock, ChevronLeft, Award, BookOpen, Sparkles } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';

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
}

interface PeerReview {
  id: string;
  session_id: string;
  reviewer_id: string;
  reviewee_id: string;
  rubric_scores: {
    communication: number;
    technical_knowledge: number;
    problem_solving: number;
    overall_impression: number;
  };
  notes: string;
  created_at: string;
}

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

  const loadSession = async () => {
    try {
      const { data, error } = await supabase
        .from('mock_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (error) throw error;

      setSession(data);
      const sessionTime = new Date(data.session_time);
      const now = new Date();
      const timeDiff = Math.floor((sessionTime.getTime() - now.getTime()) / 1000);
      setRemainingTime(timeDiff > 0 ? timeDiff : 0);
    } catch (error) {
      console.error('Error loading session:', error);
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
      console.error('Error accessing media devices:', error);
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
      console.error('Error ending session:', error);
      toast({
        title: 'Error',
        description: 'Failed to end the session',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="container mx-auto py-8">
          <Card className="bg-gradient-to-r from-purple-50 to-indigo-50 border-purple-200 shadow-lg">
            <CardContent className="flex items-center justify-center py-12">
              <Spinner size="lg" className="text-indigo-600" />
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  if (!session) {
    return (
      <AppLayout>
        <div className="container mx-auto py-8">
          <Card className="bg-gradient-to-r from-red-100 to-orange-100 border-red-200 shadow-lg">
            <CardContent className="py-8 text-center">
              <p className="text-red-600 font-medium">Session not found</p>
              <Button 
                onClick={() => navigate('/interview-prep/mock-interviews')}
                variant="outline" 
                className="mt-4 border-red-200 hover:bg-red-100 text-red-600"
              >
                Return to Mock Interviews
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  const isInterviewer =
    (session.user1_id === user?.id && session.role1 === 'interviewer') ||
    (session.user2_id === user?.id && session.role2 === 'interviewer');

  return (
    <AppLayout>
      <div className="container mx-auto py-8 relative">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-100/30 via-purple-100/20 to-blue-100/30 rounded-xl -z-10"></div>
        
        <div className="mb-8 relative">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 rounded-2xl -z-10"></div>
          <div className="flex items-center gap-2 mb-4">
            <Button variant="outline" size="sm" onClick={() => navigate('/interview-prep/mock-interviews')} 
              className="border-indigo-200 bg-white/90 hover:bg-indigo-50 shadow-sm text-indigo-700">
              <ChevronLeft className="h-4 w-4 mr-1 text-indigo-600" />
              <span>Back to Mock Interviews</span>
            </Button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-indigo-700 to-purple-700 bg-clip-text text-transparent">
                {session.type === 'behavioral' ? 'Behavioral' : 'Technical'} Interview
              </h1>
              <p className="text-indigo-600">
                {format(new Date(session.session_time), 'PPP p')}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-white/90 p-2 rounded-full px-4 shadow-sm">
                <Clock className="h-4 w-4 text-indigo-500" />
                <span className="text-sm text-indigo-700 font-medium">
                  {remainingTime ? `Starts in ${Math.floor(remainingTime / 60)}:${remainingTime % 60}` : 'In Progress'}
                </span>
              </div>
              <Badge variant="outline" 
                className="bg-gradient-to-r from-indigo-100 to-purple-100 border-indigo-200 text-indigo-800 px-3 py-1 shadow-sm">
                {isInterviewer ? 'Interviewer' : 'Interviewee'}
              </Badge>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <div className="grid grid-cols-2 gap-4">
              <div className="aspect-video bg-black rounded-lg overflow-hidden relative shadow-xl border-4 border-indigo-200 transform transition-all hover:scale-[1.01]">
                <div className="absolute inset-0 bg-gradient-to-tl from-indigo-900/30 via-transparent to-purple-900/20"></div>
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/40 p-2 rounded-full backdrop-blur-sm">
                  <Button
                    variant="secondary"
                    size="icon"
                    onClick={toggleVideo}
                    className="bg-white/20 hover:bg-white/30 border-none"
                  >
                    {isVideoEnabled ? (
                      <Video className="h-4 w-4 text-white" />
                    ) : (
                      <VideoOff className="h-4 w-4 text-white" />
                    )}
                  </Button>
                  <Button
                    variant="secondary"
                    size="icon"
                    onClick={toggleAudio}
                    className="bg-white/20 hover:bg-white/30 border-none"
                  >
                    {isAudioEnabled ? (
                      <Mic className="h-4 w-4 text-white" />
                    ) : (
                      <MicOff className="h-4 w-4 text-white" />
                    )}
                  </Button>
                  <Button
                    variant="destructive"
                    size="icon"
                    onClick={endSession}
                    className="bg-red-500/90 hover:bg-red-600/90 border-none"
                  >
                    <Phone className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="aspect-video bg-black rounded-lg overflow-hidden shadow-xl border-4 border-purple-200 transform transition-all hover:scale-[1.01]">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-900/30 via-transparent to-indigo-900/20"></div>
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            {isInterviewer && (
              <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-amber-100 overflow-hidden shadow-lg">
                <CardHeader className="bg-gradient-to-r from-amber-100/50 to-orange-100/50 border-b border-amber-100/50">
                  <div className="flex items-center">
                    <BookOpen className="h-5 w-5 text-amber-600 mr-2" />
                    <CardTitle className="text-amber-900 font-display">Interview Questions</CardTitle>
                  </div>
                  <CardDescription className="text-amber-700">
                    Suggested questions based on the selected interview type.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-4">
                    {session.type === 'behavioral' ? (
                      <>
                        <li className="p-3 bg-white/70 rounded-md border-l-4 border-amber-400 text-amber-800 shadow-sm hover:bg-white/90 transition-colors">Tell me about a challenging project you worked on.</li>
                        <li className="p-3 bg-white/70 rounded-md border-l-4 border-amber-400 text-amber-800 shadow-sm hover:bg-white/90 transition-colors">How do you handle conflicts in a team?</li>
                        <li className="p-3 bg-white/70 rounded-md border-l-4 border-amber-400 text-amber-800 shadow-sm hover:bg-white/90 transition-colors">Describe a situation where you had to learn something quickly.</li>
                      </>
                    ) : (
                      <>
                        <li className="p-3 bg-white/70 rounded-md border-l-4 border-orange-400 text-orange-800 shadow-sm hover:bg-white/90 transition-colors">Explain the concept of object-oriented programming.</li>
                        <li className="p-3 bg-white/70 rounded-md border-l-4 border-orange-400 text-orange-800 shadow-sm hover:bg-white/90 transition-colors">What are the differences between arrays and linked lists?</li>
                        <li className="p-3 bg-white/70 rounded-md border-l-4 border-orange-400 text-orange-800 shadow-sm hover:bg-white/90 transition-colors">How would you optimize a slow database query?</li>
                      </>
                    )}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>

          {isInterviewer && (
            <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-100 overflow-hidden shadow-lg">
              <CardHeader className="bg-gradient-to-r from-emerald-100/50 to-teal-100/50 border-b border-emerald-100/50">
                <div className="flex items-center">
                  <Award className="h-5 w-5 text-emerald-600 mr-2" />
                  <CardTitle className="text-emerald-900 font-display">Evaluation Form</CardTitle>
                </div>
                <CardDescription className="text-emerald-700">
                  Rate the candidate's performance and provide feedback.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 pt-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-emerald-900">Communication</label>
                      <span className="text-sm text-emerald-600 font-medium bg-emerald-100 px-2 py-0.5 rounded-full shadow-sm">
                        {reviewScores.communication}/10
                      </span>
                    </div>
                    <Slider
                      value={[reviewScores.communication]}
                      min={1}
                      max={10}
                      step={1}
                      className="text-emerald-500"
                      onValueChange={([value]) =>
                        setReviewScores(prev => ({ ...prev, communication: value }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-emerald-900">Technical Knowledge</label>
                      <span className="text-sm text-emerald-600 font-medium bg-emerald-100 px-2 py-0.5 rounded-full shadow-sm">
                        {reviewScores.technical_knowledge}/10
                      </span>
                    </div>
                    <Slider
                      value={[reviewScores.technical_knowledge]}
                      min={1}
                      max={10}
                      step={1}
                      className="text-emerald-500"
                      onValueChange={([value]) =>
                        setReviewScores(prev => ({ ...prev, technical_knowledge: value }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-emerald-900">Problem Solving</label>
                      <span className="text-sm text-emerald-600 font-medium bg-emerald-100 px-2 py-0.5 rounded-full shadow-sm">
                        {reviewScores.problem_solving}/10
                      </span>
                    </div>
                    <Slider
                      value={[reviewScores.problem_solving]}
                      min={1}
                      max={10}
                      step={1}
                      className="text-emerald-500"
                      onValueChange={([value]) =>
                        setReviewScores(prev => ({ ...prev, problem_solving: value }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-emerald-900">Overall Impression</label>
                      <span className="text-sm text-emerald-600 font-medium bg-emerald-100 px-2 py-0.5 rounded-full shadow-sm">
                        {reviewScores.overall_impression}/10
                      </span>
                    </div>
                    <Slider
                      value={[reviewScores.overall_impression]}
                      min={1}
                      max={10}
                      step={1}
                      className="text-emerald-500"
                      onValueChange={([value]) =>
                        setReviewScores(prev => ({ ...prev, overall_impression: value }))
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-emerald-900">Feedback Notes</label>
                  <Textarea
                    placeholder="Provide detailed feedback about the candidate's performance..."
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    className="min-h-[200px] border-emerald-200 focus:border-emerald-300 bg-white/80 shadow-sm focus:ring-emerald-200"
                  />
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
