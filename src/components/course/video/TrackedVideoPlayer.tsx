/**
 * Tracked Video Player
 * Enhanced video player with progress tracking, analytics, and resume functionality
 * Supports YouTube, Vimeo, and direct video URLs
 */

import React, { useState, useEffect, useRef } from 'react';
import { getVideoKind, toVideoEmbedUrl } from '@/utils/videoUrls';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  SkipBack,
  SkipForward,
  Settings,
  CheckCircle2,
} from 'lucide-react';
import videoAnalyticsService from '@/services/videoAnalyticsService';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { createLogger } from '@/utils/logger';

const logger = createLogger('TrackedVideoPlayer');

export interface VideoPlayerProps {
  contentItemId: string;
  videoUrl: string;
  title?: string;
  autoPlay?: boolean;
  onComplete?: () => void;
  showAnalytics?: boolean; // Show progress stats to user
}

export const TrackedVideoPlayer: React.FC<VideoPlayerProps> = ({
  contentItemId,
  videoUrl,
  title,
  autoPlay = false,
  onComplete,
  showAnalytics = true,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();

  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [completionPercentage, setCompletionPercentage] = useState(0);
  const [watchTime, setWatchTime] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [loading, setLoading] = useState(true);

  // Tracking state
  const lastUpdateRef = useRef<number>(Date.now());
  const watchStartRef = useRef<number | null>(null);

  // Load previous progress on mount
  useEffect(() => {
    if (user && contentItemId) {
      loadProgress();
    }
  }, [user, contentItemId]);

  // Save progress periodically
  useEffect(() => {
    if (!user || !contentItemId) return;

    const interval = setInterval(() => {
      if (isPlaying) {
        saveProgress();
      }
    }, 10000); // Save every 10 seconds

    return () => clearInterval(interval);
  }, [isPlaying, currentTime, user, contentItemId]);

  // Track watch time
  useEffect(() => {
    if (isPlaying) {
      watchStartRef.current = Date.now();
    } else if (watchStartRef.current) {
      const watchedMs = Date.now() - watchStartRef.current;
      setWatchTime((prev) => prev + Math.floor(watchedMs / 1000));
      watchStartRef.current = null;
    }
  }, [isPlaying]);

  const loadProgress = async () => {
    if (!user) return;

    try {
      const progress = await videoAnalyticsService.getVideoProgress(
        user.id,
        contentItemId
      );

      if (progress && videoRef.current) {
        setCompletionPercentage(progress.completionPercentage);
        setCompleted(progress.completed);

        // Resume from last position (if more than 5% watched and not near end)
        if (progress.lastPosition > 5 && progress.completionPercentage < 95) {
          videoRef.current.currentTime = progress.lastPosition;

          toast({
            title: 'Resuming video',
            description: `Picking up where you left off at ${formatTime(progress.lastPosition)}`,
          });
        }
      }
    } catch (error) {
      logger.error('Error loading video progress', error);
    }
  };

  const saveProgress = async () => {
    if (!user || !videoRef.current) return;

    try {
      const currentPosition = videoRef.current.currentTime;
      const videoDuration = videoRef.current.duration;
      const completion = Math.min(
        100,
        Math.round((currentPosition / videoDuration) * 100)
      );

      await videoAnalyticsService.updateEngagement(user.id, contentItemId, {
        watchTime,
        lastPosition: Math.floor(currentPosition),
        completionPercentage: completion,
        videoDuration: Math.floor(videoDuration),
        playbackSpeed,
      });

      setCompletionPercentage(completion);

      // Mark as completed if watched 90% or more
      if (completion >= 90 && !completed) {
        await videoAnalyticsService.markCompleted(user.id, contentItemId);
        setCompleted(true);

        if (onComplete) {
          onComplete();
        }

        toast({
          title: 'Video completed!',
          description: 'Great job! Your progress has been saved.',
        });
      }
    } catch (error) {
      logger.error('Error saving video progress', error);
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePlayPause = async () => {
    if (!videoRef.current) return;

    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);

      // Track pause
      if (user) {
        await videoAnalyticsService.updateEngagement(user.id, contentItemId, {
          incrementPauseCount: true,
        });
      }
    } else {
      await videoRef.current.play();
      setIsPlaying(true);

      // Track play
      if (user) {
        await videoAnalyticsService.updateEngagement(user.id, contentItemId, {
          incrementPlayCount: true,
        });
      }
    }
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    setCurrentTime(videoRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    setDuration(videoRef.current.duration);
    setLoading(false);
  };

  const handleSeek = async (value: number[]) => {
    if (!videoRef.current) return;

    const newTime = value[0];
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);

    // Track seek
    if (user) {
      await videoAnalyticsService.updateEngagement(user.id, contentItemId, {
        incrementSeekCount: true,
      });
    }
  };

  const handleVolumeChange = (value: number[]) => {
    if (!videoRef.current) return;

    const newVolume = value[0];
    videoRef.current.volume = newVolume;
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  const toggleMute = () => {
    if (!videoRef.current) return;

    if (isMuted) {
      videoRef.current.volume = volume > 0 ? volume : 0.5;
      setIsMuted(false);
    } else {
      videoRef.current.volume = 0;
      setIsMuted(true);
    }
  };

  const changePlaybackSpeed = (speed: number) => {
    if (!videoRef.current) return;

    videoRef.current.playbackRate = speed;
    setPlaybackSpeed(speed);
  };

  const handleSkip = (seconds: number) => {
    if (!videoRef.current) return;

    const newTime = Math.max(0, Math.min(duration, currentTime + seconds));
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      videoRef.current?.parentElement?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Classified by parsed hostname, and the iframe src is rebuilt from the
  // validated video ID on a fixed origin — never from the raw URL. The old
  // substring check meant https://evil.com/youtube.com classified as YouTube
  // and was then framed verbatim (CodeQL
  // js/incomplete-url-substring-sanitization). A URL that looks like a video
  // host but yields no parseable ID plays as 'direct', which fails visibly
  // instead of framing an arbitrary page.
  const embedUrl = toVideoEmbedUrl(videoUrl);
  const videoType: 'youtube' | 'vimeo' | 'direct' =
    embedUrl ? (getVideoKind(videoUrl) as 'youtube' | 'vimeo') : 'direct';

  return (
    <Card className="overflow-hidden">
      {title && (
        <div className="px-4 py-3 border-b">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">{title}</h3>
            {completed && (
              <Badge variant="default" className="gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Completed
              </Badge>
            )}
          </div>
          {showAnalytics && (
            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
              <span>Progress: {completionPercentage}%</span>
              <span>Watch time: {formatTime(watchTime)}</span>
            </div>
          )}
        </div>
      )}

      <CardContent className="p-0">
        {/* Deliberate single-theme dark video chrome — Ink Studio ground (#17151C), not a theme token */}
        <div className="relative bg-[#17151C] aspect-video">
          {/* Native video player for direct URLs */}
          {videoType === 'direct' && (
            <>
              <video
                ref={videoRef}
                className="w-full h-full"
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onEnded={() => {
                  setIsPlaying(false);
                  saveProgress();
                }}
                autoPlay={autoPlay}
              >
                <source src={videoUrl} type="video/mp4" />
                Your browser does not support the video tag.
              </video>

              {/* Custom Controls */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 space-y-2">
                {/* Progress Bar */}
                <Slider
                  value={[currentTime]}
                  max={duration}
                  step={1}
                  onValueChange={handleSeek}
                  className="cursor-pointer"
                />

                {/* Control Buttons */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={handlePlayPause}
                      className="text-white hover:text-white hover:bg-white/20"
                    >
                      {isPlaying ? (
                        <Pause className="h-5 w-5" />
                      ) : (
                        <Play className="h-5 w-5" />
                      )}
                    </Button>

                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleSkip(-10)}
                      className="text-white hover:text-white hover:bg-white/20"
                    >
                      <SkipBack className="h-4 w-4" />
                    </Button>

                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleSkip(10)}
                      className="text-white hover:text-white hover:bg-white/20"
                    >
                      <SkipForward className="h-4 w-4" />
                    </Button>

                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={toggleMute}
                      className="text-white hover:text-white hover:bg-white/20"
                    >
                      {isMuted ? (
                        <VolumeX className="h-4 w-4" />
                      ) : (
                        <Volume2 className="h-4 w-4" />
                      )}
                    </Button>

                    <div className="w-20">
                      <Slider
                        value={[isMuted ? 0 : volume]}
                        max={1}
                        step={0.1}
                        onValueChange={handleVolumeChange}
                        className="cursor-pointer"
                      />
                    </div>

                    <span className="text-white text-sm">
                      {formatTime(currentTime)} / {formatTime(duration)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Playback Speed */}
                    <select
                      value={playbackSpeed}
                      onChange={(e) => changePlaybackSpeed(Number(e.target.value))}
                      className="bg-white/20 text-white text-sm rounded px-2 py-1 border-none outline-none cursor-pointer"
                    >
                      <option value={0.5}>0.5x</option>
                      <option value={0.75}>0.75x</option>
                      <option value={1}>1x</option>
                      <option value={1.25}>1.25x</option>
                      <option value={1.5}>1.5x</option>
                      <option value={2}>2x</option>
                    </select>

                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={toggleFullscreen}
                      className="text-white hover:text-white hover:bg-white/20"
                    >
                      {isFullscreen ? (
                        <Minimize className="h-4 w-4" />
                      ) : (
                        <Maximize className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* YouTube Embed */}
          {videoType === 'youtube' && (
            <iframe
              src={embedUrl!}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          )}

          {/* Vimeo Embed */}
          {videoType === 'vimeo' && (
            <iframe
              src={embedUrl!}
              className="w-full h-full"
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
            />
          )}
        </div>

        {/* Progress Indicator */}
        {showAnalytics && completionPercentage > 0 && (
          <div className="px-4 py-2 bg-muted/30">
            <Progress value={completionPercentage} className="h-1" />
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TrackedVideoPlayer;
