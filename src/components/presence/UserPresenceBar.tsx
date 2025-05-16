
import React, { useEffect } from 'react';
import { usePageVisibility } from '@/contexts/PageVisibilityContext';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Users } from 'lucide-react';
import { getUserInitials, getFullName } from '@/utils/profileUtils';

export const UserPresenceBar = () => {
  const { onlineUsers, currentUserPresence } = usePageVisibility();
  const { user } = useAuth();

  if (!user || onlineUsers.length === 0) {
    return null;
  }

  const otherUsers = onlineUsers.filter(u => u.id !== user.id);
  const totalOnline = onlineUsers.length;

  return (
    <div className="px-3 py-2 border-b bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
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
                  <Avatar className="h-6 w-6 border-2 border-primary">
                    <AvatarImage 
                      src={currentUserPresence?.avatar_url || ''} 
                      alt="You" 
                    />
                    <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                      {getUserInitials(currentUserPresence?.first_name, currentUserPresence?.last_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full border border-white dark:border-gray-900"></div>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                <p>You ({getFullName(currentUserPresence?.first_name, currentUserPresence?.last_name)})</p>
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
                        {getUserInitials(onlineUser.first_name, onlineUser.last_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full border border-white dark:border-gray-900"></div>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  <p>{getFullName(onlineUser.first_name, onlineUser.last_name)}</p>
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
    </div>
  );
};
