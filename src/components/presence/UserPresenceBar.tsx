
import React, { useEffect, useState } from 'react';
import { usePageVisibility } from '@/contexts/PageVisibilityContext';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Users } from 'lucide-react';
import { getUserInitials, getFullName } from '@/utils/profileUtils';
import { supabase } from '@/integrations/supabase/client';

import { createLogger } from '@/utils/logger';

const logger = createLogger('UserPresenceBar');

export const UserPresenceBar = () => {
  const { onlineUsers, currentUserPresence } = usePageVisibility();
  const { user } = useAuth();
  const [profileData, setProfileData] = useState<{ avatar_url?: string; first_name?: string; last_name?: string } | null>(null);

  // Debug logs to understand current state
  useEffect(() => {
    logger.log('[UserPresenceBar] Rendered with online users:', onlineUsers);
    logger.log('[UserPresenceBar] Current user presence:', currentUserPresence);
    logger.log('[UserPresenceBar] Auth user:', user);
  }, [onlineUsers, currentUserPresence, user]);

  useEffect(() => {
    const fetchProfileData = async () => {
      if (!user) return;

      try {
        logger.log('[UserPresenceBar] Fetching profile data for user:', user.id);
        
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('first_name, last_name, avatar_url')
          .eq('id', user.id)
          .single();

        if (error) {
          logger.error('[UserPresenceBar] Error fetching profile:', error);
          return;
        }

        if (profile) {
          logger.log('[UserPresenceBar] Profile data fetched:', profile);
          setProfileData(profile);
        }
      } catch (error) {
        logger.error('[UserPresenceBar] Exception while fetching profile:', error);
      }
    };

    fetchProfileData();
  }, [user]);

  // If no authenticated user or no online users, don't render the bar
  if (!user) {
    logger.log('[UserPresenceBar] No authenticated user, not rendering');
    return null;
  }

  // There is no realtime presence subscription wired up anywhere —
  // PageVisibilityContext never calls setOnlineUsers — so onlineUsers is
  // always empty. Rendering a "1 online" bar in that state fabricates live
  // presence data; hide the bar until real presence tracking exists.
  if (onlineUsers.length === 0) {
    return null;
  }

  const otherUsers = onlineUsers.filter(u => u.id !== user.id);
  const totalOnline = onlineUsers.length;

  // Get current user's display info, prioritizing profile data
  // Using user_metadata which exists on EnrichedUser instead of direct first_name/last_name
  const currentUserFirstName = profileData?.first_name || currentUserPresence?.first_name || user?.user_metadata?.first_name || '';
  const currentUserLastName = profileData?.last_name || currentUserPresence?.last_name || user?.user_metadata?.last_name || '';
  const currentUserAvatar = profileData?.avatar_url || currentUserPresence?.avatar_url || user?.user_metadata?.avatar_url || '';

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
          {/* Current user avatar - always show this */}
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="relative">
                  <Avatar className="h-6 w-6 border-2 border-primary">
                    <AvatarImage 
                      src={currentUserAvatar}
                      alt="You" 
                    />
                    <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                      {getUserInitials(currentUserFirstName, currentUserLastName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full border border-white dark:border-gray-900"></div>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                <p>You ({getFullName(currentUserFirstName, currentUserLastName)})</p>
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
                        src={onlineUser.avatar_url} 
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
      
      {/* Dev-only debug hint removed — showDebugInfo state was never wired. */}

    </div>
  );
};
