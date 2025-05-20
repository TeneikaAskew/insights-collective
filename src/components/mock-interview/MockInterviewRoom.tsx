
import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/hooks/use-user';
import { supabase } from '@/integrations/supabase/client';
import { Spinner } from '@/components/ui/spinner';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';
import { Mic, MicOff, Camera, CameraOff, Phone, MessageSquare } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Message {
  id: string;
  sender_id: string;
  content: string;
  timestamp: string;
}

export default function MockInterviewRoom() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { toast } = useToast();
  const { user } = useUser();
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);

  useEffect(() => {
    loadSession();
    setupWebRTC();
    return () => {
      cleanupWebRTC();
    };
  }, []);

  const loadSession = async () => {
    try {
      const { data: session, error } = await supabase
        .from('mock_sessions')
        .select('*, user1:user1_id(*), user2:user2_id(*)')
        .eq('id', sessionId)
        .single();

      if (error) throw error;

      setSession(session);

      // Subscribe to messages
      const messagesSubscription = supabase
        .channel(`mock-interview-${sessionId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `session_id=eq.${sessionId}`,
          },
          (payload) => {
            setMessages((messages) => [...messages, payload.new as Message]);
          }
        )
        .subscribe();

      return () => {
        messagesSubscription.unsubscribe();
      };
    } catch (error) {
      console.error('Error loading session:', error);
      toast({
        title: 'Error',
        description: 'Failed to load interview session.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const setupWebRTC = async () => {
    try {
      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Create peer connection
      const configuration = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          {
            urls: 'turn:your-turn-server.com',
            username: 'username',
            credential: 'credential',
          },
        ],
      };

      const peerConnection = new RTCPeerConnection(configuration);
      peerConnectionRef.current = peerConnection;

      // Add local tracks
      stream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, stream);
      });

      // Handle remote tracks
      peerConnection.ontrack = (event) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      };

      // Create data channel
      const dataChannel = peerConnection.createDataChannel('chat');
      dataChannelRef.current = dataChannel;

      dataChannel.onmessage = (event) => {
        const message = JSON.parse(event.data);
        setMessages((messages) => [...messages, message]);
      };

      // Handle connection state changes
      peerConnection.onconnectionstatechange = () => {
        if (peerConnection.connectionState === 'disconnected') {
          toast({
            title: 'Connection Lost',
            description: 'The connection to your peer has been lost.',
            variant: 'destructive',
          });
        }
      };

      // Handle ICE candidates
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          // Send the candidate to the remote peer via your signaling server
          // This is where you would implement your signaling mechanism
        }
      };

      // Create and send offer if you're the initiator
      if (session?.user1_id === user?.id) {
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        // Send the offer to the remote peer via your signaling server
        // This is where you would implement your signaling mechanism
      }
    } catch (error) {
      console.error('Error setting up WebRTC:', error);
      toast({
        title: 'Error',
        description: 'Failed to setup video call. Please check your camera and microphone permissions.',
        variant: 'destructive',
      });
    }
  };

  const cleanupWebRTC = () => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
    if (localVideoRef.current?.srcObject) {
      (localVideoRef.current.srcObject as MediaStream)
        .getTracks()
        .forEach((track) => track.stop());
    }
  };

  const toggleAudio = () => {
    if (localVideoRef.current?.srcObject) {
      const audioTrack = (localVideoRef.current.srcObject as MediaStream)
        .getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioEnabled;
        setAudioEnabled(!audioEnabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localVideoRef.current?.srcObject) {
      const videoTrack = (localVideoRef.current.srcObject as MediaStream)
        .getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoEnabled;
        setVideoEnabled(!videoEnabled);
      }
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !user) return;

    try {
      const { data: message, error } = await supabase
        .from('messages')
        .insert({
          session_id: sessionId,
          sender_id: user.id,
          content: newMessage,
        })
        .select()
        .single();

      if (error) throw error;

      // Also send via data channel for real-time delivery
      if (dataChannelRef.current?.readyState === 'open') {
        dataChannelRef.current.send(JSON.stringify(message));
      }

      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: 'Error',
        description: 'Failed to send message.',
        variant: 'destructive',
      });
    }
  };

  const handleEndCall = async () => {
    try {
      await supabase
        .from('mock_sessions')
        .update({ status: 'completed' })
        .eq('id', sessionId);

      cleanupWebRTC();
      window.location.href = '/mock-interviews';
    } catch (error) {
      console.error('Error ending call:', error);
      toast({
        title: 'Error',
        description: 'Failed to end call.',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-100">
          <CardContent className="flex items-center justify-center py-8">
            <Spinner size="lg" className="text-blue-600" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="container mx-auto py-8">
        <Card className="bg-gradient-to-r from-red-50 to-orange-50 border-red-100">
          <CardHeader>
            <CardTitle className="text-red-800">Session Not Found</CardTitle>
            <CardDescription className="text-red-600">
              The interview session you're looking for doesn't exist.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => window.history.back()} variant="outline" className="border-red-200 hover:bg-red-100">Go Back</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isInterviewer = session.user1_id === user?.id ? session.role1 === 'interviewer' : session.role2 === 'interviewer';

  return (
    <div className="container mx-auto py-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <Card className="bg-gradient-to-tr from-indigo-50 via-purple-50 to-pink-50 border-purple-100 overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-purple-100/50 to-indigo-100/50">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-indigo-900">Mock Interview Session</CardTitle>
                  <CardDescription className="text-indigo-700">
                    {format(new Date(session.session_time), 'MMMM d, yyyy h:mm a')}
                  </CardDescription>
                </div>
                <Badge className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 border-none text-white font-medium py-1">{session.type}</Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="relative">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full rounded-lg bg-black border-2 border-indigo-300 shadow-lg"
                  />
                  <div className="absolute bottom-4 left-4">
                    <Badge variant="secondary" className="bg-indigo-100 text-indigo-800 border border-indigo-200">You ({isInterviewer ? 'Interviewer' : 'Interviewee'})</Badge>
                  </div>
                </div>
                <div className="relative">
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className="w-full rounded-lg bg-black border-2 border-purple-300 shadow-lg"
                  />
                  <div className="absolute bottom-4 left-4">
                    <Badge variant="secondary" className="bg-purple-100 text-purple-800 border border-purple-200">
                      Peer ({isInterviewer ? 'Interviewee' : 'Interviewer'})
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-center gap-4 mt-6">
                <Button
                  variant={audioEnabled ? 'default' : 'destructive'}
                  size="icon"
                  onClick={toggleAudio}
                  className={audioEnabled ? "bg-blue-500 hover:bg-blue-600" : ""}
                >
                  {audioEnabled ? (
                    <Mic className="h-4 w-4" />
                  ) : (
                    <MicOff className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant={videoEnabled ? 'default' : 'destructive'}
                  size="icon"
                  onClick={toggleVideo}
                  className={videoEnabled ? "bg-indigo-500 hover:bg-indigo-600" : ""}
                >
                  {videoEnabled ? (
                    <Camera className="h-4 w-4" />
                  ) : (
                    <CameraOff className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="destructive"
                  size="icon"
                  onClick={handleEndCall}
                  className="bg-red-500 hover:bg-red-600"
                >
                  <Phone className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {isInterviewer && session.type === 'behavioral' && (
            <Card className="bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-100">
              <CardHeader className="bg-gradient-to-r from-amber-100/50 to-yellow-100/50">
                <CardTitle className="text-amber-900">Suggested Questions</CardTitle>
                <CardDescription className="text-amber-700">
                  Questions based on the interviewee's study guide.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {session.study_guide?.questions?.map((question: any) => (
                    <li key={question.id} className="text-sm bg-amber-100/50 p-3 rounded-md border-l-4 border-amber-400 text-amber-800">
                      {question.question}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>

        <div>
          <Card className="h-full bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-100">
            <CardHeader className="bg-gradient-to-r from-blue-100/50 to-cyan-100/50">
              <CardTitle className="text-blue-900">Chat</CardTitle>
              <CardDescription className="text-blue-700">
                Send messages to your peer during the interview.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col h-[600px]">
                <ScrollArea className="flex-1 mb-4 pr-4">
                  <div className="space-y-4">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${
                          message.sender_id === user?.id ? 'justify-end' : 'justify-start'
                        }`}
                      >
                        <div
                          className={`rounded-lg px-4 py-2 max-w-[80%] ${
                            message.sender_id === user?.id
                              ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white'
                              : 'bg-gradient-to-r from-gray-100 to-gray-200 text-gray-800'
                          }`}
                        >
                          <p className="text-sm">{message.content}</p>
                          <p className={`text-xs ${message.sender_id === user?.id ? 'text-blue-100' : 'text-gray-500'}`}>
                            {format(new Date(message.timestamp), 'h:mm a')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                <div className="flex gap-2">
                  <Textarea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 border-blue-200 focus:border-blue-300 bg-white/80"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                  />
                  <Button
                    size="icon"
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim()}
                    className="bg-blue-500 hover:bg-blue-600 text-white"
                  >
                    <MessageSquare className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
