
import React from 'react';
import { usePageVisibility } from '@/contexts/PageVisibilityContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';

export default function UserPresenceBar() {
  const { onlineUsers } = usePageVisibility();
  const { user } = useAuth();
  
  if (!onlineUsers || onlineUsers.length === 0) return null;
  
  return (
    <div className="flex items-center gap-1 overflow-x-auto p-1 border-b bg-background/95 backdrop-blur-sm">
      <Badge variant="outline" className="rounded-full px-2 py-0 text-xs font-medium text-muted-foreground h-6">
        {onlineUsers.length} online
      </Badge>
      
      <div className="flex -space-x-2">
        <TooltipProvider delayDuration={300}>
          {onlineUsers.map((onlineUser) => {
            const isCurrentUser = user?.id === onlineUser.user_id;
            const initials = getInitials(onlineUser.name || '');
            
            return (
              <Tooltip key={onlineUser.user_id}>
                <TooltipTrigger asChild>
                  <div className={`relative ${isCurrentUser ? 'z-10' : ''}`}>
                    <Avatar className={`h-6 w-6 border ${isCurrentUser ? 'border-primary' : 'border-muted'}`}>
                      <AvatarImage src={onlineUser.avatar_url} alt={onlineUser.name || 'User'} />
                      <AvatarFallback className="text-[9px]">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    {isCurrentUser && (
                      <span className="absolute bottom-[-2px] right-[-2px] h-2 w-2 rounded-full bg-primary border border-background" />
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <div className="flex flex-col text-xs">
                    <span>{onlineUser.name || 'Anonymous User'} {isCurrentUser && '(You)'}</span>
                    {onlineUser.current_path && (
                      <span className="text-muted-foreground text-[10px]">
                        On: {getPageName(onlineUser.current_path)}
                      </span>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </TooltipProvider>
      </div>
    </div>
  );
}

// Helper functions
function getInitials(name: string): string {
  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function getPageName(path: string): string {
  const pathParts = path.split('/').filter(Boolean);
  if (pathParts.length === 0) return 'Home';
  
  const lastPart = pathParts[pathParts.length - 1];
  const cleanPart = lastPart.replace(/[-_]/g, ' ');
  
  return cleanPart.charAt(0).toUpperCase() + cleanPart.slice(1);
}
