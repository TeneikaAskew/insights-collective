

import { useState, useEffect } from 'react'; import { supabase } from '@/integrations/supabase/client'; import { Message, Profile } from '@/types/supabase'; import { useAuth } from '@/contexts/AuthContext'; import { useToast } from './use-toast'; import { enrichProfileWithRoles } from '@/utils/prof

pasted


import { supabase } from '@/integrations/supabase/client'; import { Conversation, Message, Profile, ConversationParticipant } from '@/types/supabase'; import { enrichProfileWithRoles } from '@/utils/profileUtils'; export const archiveConversation = async (id: string, archive: boolean = true) => {

pasted


import React, { useState, useEffect } from 'react'; import { useParams, useNavigate } from 'react-router-dom'; import { MessageSquare, Send, Search } from 'lucide-react'; import { Button } from '@/components/ui/button'; import { Input } from '@/components/ui/input'; import { Tabs, TabsContent, TabsL

pasted


import { useState, useEffect } from 'react'; import { supabase } from '@/integrations/supabase/client'; import { Message, Profile } from '@/types/supabase'; import { useAuth } from '@/contexts/AuthContext'; import { useToast } from './use-toast'; import { enrichProfileWithRoles } from '@/utils/prof

pasted


import React from 'react'; import { useNavigate } from 'react-router-dom'; import { AlertCircle, ArchiveRestore } from 'lucide-react'; import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'; import { Card } from '@/components/ui/card'; import { Skeleton } from '@/components/ui

pasted

I have the following files, i want to Remove any fallbacks on the user names and pictures, every message in the list should show the user name, i had the subject set to retrieve the first name and last name and the avatar should retrieve that from their profile, users can do that so the chat list should reflect proper names and avatars. The messages are not being removed from inbox when archived or deleted, it needs to be refreshed immediately upon clicking the button - check to make sure archive and delete operations are working. Archived messages do not move from Inbox to Archived, and Deleted messages are being removed from the view. When new messages are recived, there are no indicators happening that show new messages have been received on the messages page or within the side bar beside the navigation item Messages. User names are not showing in the conversation list, it just shows Unknown, it should never show unknown unless the first name and last name both null The search is not actually searching through the messages, it should be filtering out as users type

Based on the code you've shared, I can see several issues that need fixing. Let's address each problem systematically:

1. Name Fallbacks in Conversation Lists
The issue appears in the ArchivedConversationsList component where it's showing "Unknown" for user names. Similar logic likely exists in the regular ConversationList component (which isn't provided).

The main problem is with the fallback logic and how participants are being filtered/displayed. Let's fix how names are handled throughout the messaging system.

2. Messages not being removed when archived/deleted
This suggests we need to improve the state updates after these operations. The component needs to update its local state immediately rather than waiting for a refresh.

3. No indicators for new messages
We need to add notification indicators for new messages in both the navigation and the messages page.

4. Search functionality issues
The search function seems implemented but may not be working correctly. We need to enhance it to properly filter through messages.

Let's implement these fixes:

Fix 1: Proper name display and avatar handling
First, we need to ensure the conversation lists display proper user names by improving the participant profile handling:


Fixed ConversationList Component
Code 
Similarly, let's update the ArchivedConversationsList to properly display user information:


Fixed ArchivedConversationsList Component
Code 
Fix 2: Updating the Messages page to handle immediate updates after archive/delete actions
Let's update the Messages component to handle state updates properly:


Fixed Messages Component
Code 



import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ArchiveRestore } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';

const ArchivedConversationsList = ({
  conversations = [],
  loading,
  error,
  onRestore
}) => {
  const navigate = useNavigate();
  
  const handleClick = (id) => {
    navigate(`/messages/${id}`);
  };

  if (error) {
    return (
      <Alert variant="destructive" className="mb-4">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error loading conversations</AlertTitle>
        <AlertDescription>
          {error.message || 'Please try again later.'}
        </AlertDescription>
      </Alert>
    );
  }

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="p-4">
            <div className="flex gap-3">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-4 w-3/4 mb-2" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  // Filter only archived conversations that aren't deleted
  const archivedConversations = conversations.filter(c => c.archived === true && !c.deleted_at);
  
  if (archivedConversations.length === 0) {
    return (
      <div className="text-center p-6 text-muted-foreground">
        No archived conversations
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {archivedConversations.map((conv) => {
        const lastMessage = conv.last_message;
        const participantCount = conv.participants?.length || 0;
        
        // Find other participant(s) - exclude current user
        const otherParticipants = conv.participants?.filter(
          (p) => p.user_id !== conv.created_by
        ) || [];
        
        // Set proper display name
        let displayName = conv.subject || '';
        let avatarUrl = '';
        let avatarFallback = '';

        if (conv.is_group) {
          displayName = displayName || `Group (${participantCount} participants)`;
          avatarFallback = 'G';
        } else if (otherParticipants.length > 0) {
          const participant = otherParticipants[0];
          if (participant?.profile) {
            const firstName = participant.profile.first_name || '';
            const lastName = participant.profile.last_name || '';
            
            // Use subject if available, otherwise use participant name
            displayName = displayName || `${firstName} ${lastName}`.trim();
            
            // If we still don't have a name, only then use "Unknown"
            displayName = displayName || 'Unknown';
            
            avatarUrl = participant.profile.avatar_url || '';
            avatarFallback = firstName.charAt(0) || lastName.charAt(0) || 'U';
          }
        }

        return (
          <Card
            key={conv.id}
            className="p-3 cursor-pointer transition hover:bg-muted/50 relative"
            onClick={() => handleClick(conv.id)}
          >
            <div className="flex justify-between items-center">
              <div className="flex gap-3 items-start">
                <Avatar>
                  <AvatarImage src={avatarUrl} />
                  <AvatarFallback>
                    {avatarFallback}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium line-clamp-1">
                      {displayName}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-1">
                    {lastMessage?.content || 'No messages yet'}
                  </p>
                </div>
              </div>

              <Button 
                variant="ghost" 
                size="icon" 
                onClick={(e) => { 
                  e.stopPropagation(); 
                  onRestore?.(conv.id); 
                }}
                aria-label="Restore conversation"
              >
                <ArchiveRestore className="h-4 w-4" />
              </Button>
            </div>

            <p className="text-xs text-muted-foreground mt-1">
              {formatDistanceToNow(new Date(conv.updated_at), { addSuffix: true })}
            </p>
          </Card>
        );
      })}
    </div>
  );
};

export default ArchivedConversationsList;
