
import React from 'react';
import { usePageVisibility } from '@/contexts/PageVisibilityContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const UserPresenceBar = () => {
  const { onlineUsers } = usePageVisibility();
  const { user } = useAuth();

  // If no online users or only the current user, don't display the bar
  if (!onlineUsers || onlineUsers.length <= 1) {
    return null;
  }

  return (
    <div className="bg-muted/30 border-b py-1 px-4">
      <div className="container flex items-center justify-end gap-1.5">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Users className="h-3.5 w-3.5" />
          <span>{onlineUsers.length} online</span>
        </div>
        <div className="flex -space-x-2 ml-2">
          <TooltipProvider>
            {onlineUsers.slice(0, 7).map((presence) => {
              const isCurrentUser = presence.user_id === user?.id;
              const initials = presence.name 
                ? presence.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2)
                : '??';
                
              return (
                <Tooltip key={presence.user_id}>
                  <TooltipTrigger asChild>
                    <Avatar className={`h-6 w-6 border-2 ${
                      isCurrentUser 
                        ? 'border-primary' 
                        : 'border-background'
                    }`}>
                      <AvatarImage src={presence.avatar_url} alt={presence.name || 'User'} />
                      <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
                    </Avatar>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>{presence.name || 'Anonymous'} {isCurrentUser ? '(You)' : ''}</p>
                  </TooltipContent>
                </Tooltip>
              );
            })}
            
            {onlineUsers.length > 7 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Avatar className="h-6 w-6 border-2 border-background">
                    <AvatarFallback className="text-[10px] bg-muted">
                      +{onlineUsers.length - 7}
                    </AvatarFallback>
                  </Avatar>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>+{onlineUsers.length - 7} more users online</p>
                </TooltipContent>
              </Tooltip>
            )}
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
};

export default UserPresenceBar;
