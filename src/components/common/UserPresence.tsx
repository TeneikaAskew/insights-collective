
import React from 'react';
import { usePageVisibility } from '@/contexts/PageVisibilityContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export function UserPresence() {
  const { activeUsers } = usePageVisibility();

  if (!activeUsers || activeUsers.length === 0) return null;

  return (
    <div className="flex -space-x-2">
      <TooltipProvider delayDuration={300}>
        {activeUsers.slice(0, 5).map((user, index) => {
          const initials = `${(user.first_name?.[0] || '').toUpperCase()}${(user.last_name?.[0] || '').toUpperCase()}`;
          const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'User';
          
          return (
            <Tooltip key={user.id}>
              <TooltipTrigger asChild>
                <Avatar className="w-8 h-8 border-2 border-background transition-all hover:z-10 hover:-translate-y-1">
                  <AvatarImage src={user.avatar_url || ''} alt={fullName} />
                  <AvatarFallback className="bg-primary/80 text-primary-foreground text-xs">
                    {initials || '?'}
                  </AvatarFallback>
                </Avatar>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>{fullName}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(user.last_seen).toLocaleTimeString()}
                </p>
              </TooltipContent>
            </Tooltip>
          );
        })}
        
        {activeUsers.length > 5 && (
          <Avatar className="w-8 h-8 border-2 border-background bg-muted">
            <AvatarFallback className="text-xs">
              +{activeUsers.length - 5}
            </AvatarFallback>
          </Avatar>
        )}
      </TooltipProvider>
    </div>
  );
}
