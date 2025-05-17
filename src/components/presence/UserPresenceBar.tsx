import React, { useMemo } from 'react';
import { usePageVisibility } from '@/contexts/PageVisibilityContext';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Users, WifiOff } from 'lucide-react';
import { getUserInitials, getFullName } from '@/utils/profileUtils';

export const UserPresenceBar = () => {
  const { onlineUsers, currentUserPresence, isOnline } = usePageVisibility();
  const { user } = useAuth();

  // Don't render if no user
  if (!user) {
    return null;
  }

  // Memoize filtered users to prevent unnecessary recalculations
  const otherUsers = useMemo(() => 
    onlineUsers?.filter(u => u.id !== user.id) || [],
    [onlineUsers, user.id]
  );

  const totalOnline = onlineUsers?.length || 0;

  // Show loading state if we don't have presence data yet
  if (!currentUserPresence) {
    return (
      <div className="px-3 py-2 border-b bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
        <div className="flex items-center">
          <Users className="h-4 w-4 mr-2 text-muted-foreground animate-pulse" />
          <span className="text-xs text-muted-foreground">
            Connecting...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="px-3 py-2 border-b bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <div className="flex items-center">
            <Users className="h-4 w-4 mr-2 text-muted-foreground" />
            <span className="text-xs text-muted-foreground mr-3">
              {totalOnline} online
            </span>
          </div>
          
          <div className="flex -space-x-2 overflow-hidden">
            {/* Current user avatar */}
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="relative">
                    <Avatar className={`h-6 w-6 border-2 ${isOnline ? 'border-primary' : 'border-muted'}`}>
                      <AvatarImage 
                        src={currentUserPresence?.avatar_url || ''} 
                        alt="You" 
                      />
                      <AvatarFallback className={`text-[10px] ${isOnline ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                        {getUserInitials(currentUserPresence?.first_name, currentUserPresence?.last_name) || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-white dark:border-gray-900 ${isOnline ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  <p>
                    {currentUserPresence?.first_name || currentUserPresence?.last_name 
                      ? `You (${getFullName(currentUserPresence?.first_name, currentUserPresence?.last_name)})`
                      : 'You'} 
                    {!isOnline && ' - Offline'}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            {/* Other users (show up to 5) */}
            {otherUsers.slice(0, 5).map((onlineUser) => (
              <TooltipProvider key={onlineUser.id} delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="relative">
                      <Avatar className="h-6 w-6 border-2 border-white dark:border-gray-900">
                        <AvatarImage 
                          src={onlineUser.avatar_url || ''} 
                          alt={getFullName(onlineUser.first_name, onlineUser.last_name)} 
                        />
                        <AvatarFallback className="text-[10px]">
                          {getUserInitials(onlineUser.first_name, onlineUser.last_name) || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full border border-white dark:border-gray-900"></div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    <p>{getFullName(onlineUser.first_name, onlineUser.last_name) || 'Anonymous User'}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ))}
            
            {/* More users indicator */}
            {otherUsers.length > 5 && (
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Avatar className="h-6 w-6 border-2 border-white dark:border-gray-900">
                      <AvatarFallback className="text-[10px] bg-muted">
                        +{otherUsers.length - 5}
                      </AvatarFallback>
                    </Avatar>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    <p>{otherUsers.length - 5} more users online</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>

        {/* Offline indicator */}
        {!isOnline && (
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center text-muted-foreground">
                  <WifiOff className="h-4 w-4" />
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                <p>You are currently offline</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </div>
  );
};
