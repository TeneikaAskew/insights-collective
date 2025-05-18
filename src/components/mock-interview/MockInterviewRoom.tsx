import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';

interface MockInterviewRoomProps {
  sessionId: string;
  participantRole: 'interviewer' | 'interviewee';
}

export function MockInterviewRoom({ sessionId, participantRole }: MockInterviewRoomProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    const initializeMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        // Initialize WebRTC connection here
        // This is a placeholder for the actual WebRTC implementation
        setIsConnected(true);
      } catch (error) {
        toast({
          title: 'Media Error',
          description: 'Failed to access camera or microphone.',
          variant: 'destructive',
        });
      }
    };

    initializeMedia();

    return () => {
      // Cleanup media streams
      if (localVideoRef.current?.srcObject) {
        const tracks = (localVideoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach(track => track.stop());
      }
    };
  }, []);

  const toggleMute = () => {
    if (localVideoRef.current?.srcObject) {
      const audioTracks = (localVideoRef.current.srcObject as MediaStream)
        .getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localVideoRef.current?.srcObject) {
      const videoTracks = (localVideoRef.current.srcObject as MediaStream)
        .getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsVideoEnabled(!isVideoEnabled);
    }
  };

  return (
    <div className="grid grid-cols-2 gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Local Video</CardTitle>
        </CardHeader>
        <CardContent>
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="w-full rounded-lg"
          />
          <div className="mt-4 flex justify-center space-x-4">
            <Button
              onClick={toggleMute}
              variant={isMuted ? 'destructive' : 'default'}
            >
              {isMuted ? 'Unmute' : 'Mute'}
            </Button>
            <Button
              onClick={toggleVideo}
              variant={isVideoEnabled ? 'default' : 'destructive'}
            >
              {isVideoEnabled ? 'Disable Video' : 'Enable Video'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Remote Video</CardTitle>
        </CardHeader>
        <CardContent>
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full rounded-lg"
          />
          {!isConnected && (
            <div className="flex h-full items-center justify-center">
              <p>Waiting for peer to connect...</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 