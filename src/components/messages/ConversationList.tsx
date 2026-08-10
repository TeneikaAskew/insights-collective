import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow } from 'date-fns';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAuth } from '@/contexts/AuthContext'; // Import useAuth to get the current user ID

import { createLogger } from '@/utils/logger';

const logger = createLogger('getInitials');

const sanitizeSubject = (subject?: string | null, fallback = 'Conversation') =>
  !subject || /^(null\s*)+$/i.test(subject.trim()) ? fallback : subject;

interface ConversationListProps {
  conversations: any[];
  loading: boolean;
  error?: any;
  /** The open conversation, for highlighting. */
  selectedId?: string;
  /** Opening a thread is the host's decision — this list is rendered on more than one route. */
  onSelect: (conversationId: string) => void;
}

// Rows used to be <Link to={`/messages/${id}`}> with an onClick that preventDefault'd and
// navigated to the same place. Messages now live inside the Dashboard tab and inside a
// course, neither of which has a :conversationId segment, so the row reports the click and
// the host puts it wherever that surface keeps its open thread.
const ConversationList: React.FC<ConversationListProps> = ({
  conversations = [],
  loading,
  error,
  selectedId,
  onSelect,
}) => {
  const { user } = useAuth(); // Get the current user

  // Helper function to get initials
  const getInitials = (profile: any): string => {
    if (!profile) return 'U';
    
    const firstName = profile.first_name || '';
    const lastName = profile.last_name || '';
    
    if (!firstName && !lastName) return 'U';
    return (firstName.charAt(0) + (lastName ? lastName.charAt(0) : '')).toUpperCase();
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
              <Skeleton className="h-10 w-10 rounded-full" />
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

  if (!conversations || conversations.length === 0) {
    return (
      <div className="text-center p-6 border rounded-md bg-ss-card-warm">
        <p className="text-ss-peach-deep mb-2 font-medium">No conversations yet</p>
        <p className="text-sm text-muted-foreground">
          Messages belong to a course. Open one of your courses to message anyone in it — classmates or
          teaching staff.
        </p>
      </div>
    );
  }

  // Deduplicate conversations, keeping the most recent for each 1-on-1 pair
  const deduplicatedConversationsMap = new Map<string, any>();

  conversations.forEach((conv) => {
    if (!conv || !user) return; // Skip invalid conversations or if user is not loaded

    if (conv.is_group) {
      // Always keep group conversations, use conversation ID as key
      if (!deduplicatedConversationsMap.has(conv.id) || new Date(conv.updated_at || conv.created_at) > new Date(deduplicatedConversationsMap.get(conv.id).updated_at || deduplicatedConversationsMap.get(conv.id).created_at)) {
         deduplicatedConversationsMap.set(conv.id, conv);
      }
    } else {
      // For 1-on-1, create a unique key based on sorted participant IDs
      const participants = conv.participants || [];
      // Ensure the current user's ID is included, even if they are the creator but not explicitly listed sometimes
      const participantIds = [...new Set(participants.map((p: any) => p?.user_id).filter(Boolean))];
       if (!participantIds.includes(user.id)) {
           participantIds.push(user.id);
       }

      // Filter out potential null/undefined IDs before sorting
      const validParticipantIds = participantIds.filter(id => id != null);

      if (validParticipantIds.length === 2) { // Ensure it's a valid 1-on-1 pair
        // The course is part of the key, not just the pair.
        //
        // Threads are course-scoped now, so one student and one instructor legitimately
        // have a separate thread per course they share — open_course_thread reuses a
        // thread only within the same course. Keying on the pair alone collapsed those
        // into whichever was touched last, so asking about Course B silently hid the
        // Course A conversation. Legacy unscoped threads have no course_id and key on
        // '' , which preserves the old collapsing behavior for exactly those rows.
        const conversationKey = [...validParticipantIds.sort(), conv.course_id ?? ''].join('-');
        const existingConv = deduplicatedConversationsMap.get(conversationKey);

        // Keep the conversation with the latest update time
        if (!existingConv || new Date(conv.updated_at || conv.created_at) > new Date(existingConv.updated_at || existingConv.created_at)) {
          deduplicatedConversationsMap.set(conversationKey, conv);
        }
      } else {
         // If it's not a group and doesn't have exactly 2 valid participants, treat it uniquely by ID
         // This handles cases like conversations only with self or potential data inconsistencies
         if (!deduplicatedConversationsMap.has(conv.id) || new Date(conv.updated_at || conv.created_at) > new Date(deduplicatedConversationsMap.get(conv.id).updated_at || deduplicatedConversationsMap.get(conv.id).created_at)) {
             deduplicatedConversationsMap.set(conv.id, conv);
         }
      }
    }
  });

  const uniqueConversations = Array.from(deduplicatedConversationsMap.values());

  // Sort conversations by most recent first, prioritizing unread messages
  const sortedConversations = [...uniqueConversations].sort((a, b) => {
    // Prioritize unread messages (assuming 'read' refers to the *other* participant reading *your* message)
     const aIsUnread = a.last_message && !a.last_message.read && a.last_message.sender_id !== user?.id;
     const bIsUnread = b.last_message && !b.last_message.read && b.last_message.sender_id !== user?.id;

    if (aIsUnread && !bIsUnread) return -1;
    if (!aIsUnread && bIsUnread) return 1;

    // Then sort by date (last message date or conversation update date)
    const dateA = new Date(a.last_message?.created_at || a.updated_at || a.created_at);
    const dateB = new Date(b.last_message?.created_at || b.updated_at || b.created_at);
    return dateB.getTime() - dateA.getTime();
  });

  return (
    <div className="space-y-2 h-full overflow-auto">
      {sortedConversations.map((conversation) => {
        if (!conversation || !user) return null; // Added check for user

        // Safely handle participants - Filter out the current user
        const participants = conversation.participants || [];
        const otherParticipants = participants.filter(
          (p: any) => p?.user_id !== user.id // Use the authenticated user's ID
        );

        // Format the timestamp
        let timeAgo = '';
        try {
          if (conversation.last_message?.created_at) {
            timeAgo = formatDistanceToNow(new Date(conversation.last_message.created_at), { addSuffix: true });
          } else if (conversation.updated_at) {
            timeAgo = formatDistanceToNow(new Date(conversation.updated_at), { addSuffix: true });
          }
        } catch (error) {
          logger.error('Error formatting date:', error);
          timeAgo = 'Recently';
        }

        // Calculate if there are any unread messages for the current user
        const isUnread = conversation.last_message &&
                         !conversation.last_message.read &&
                         conversation.last_message.sender_id !== user.id; // Check against current user ID

        // Get the first other participant's profile for display
         // For groups, maybe show creator or just a generic group icon?
         // For 1-on-1, show the other person.
         // Declared without a value on purpose. Every branch below assigns both, so the
         // old `'Conversation'` / `'??'` seeds were dead — CodeQL flags them as useless
         // assignments. Dropping them turns the exhaustiveness into a compile-time
         // guarantee: add a branch that forgets to set one and TypeScript says so, where
         // before it would silently render '??' next to somebody's name.
         let displayProfile = null;
         let displayName: string;
         let avatarFallback: string;
         let avatarUrl = null;

         if (conversation.is_group) {
             displayName = sanitizeSubject(conversation.subject, `Group (${participants.length} participants)`);
             avatarFallback = 'GP';
             // Use a generic group avatar or maybe the creator's?
             const creatorProfile = participants.find((p:any) => p?.user_id === conversation.created_by)?.profile;
             avatarUrl = creatorProfile?.avatar_url; // Or a generic group icon URL
             if (!avatarUrl) avatarFallback = getInitials(creatorProfile); // Fallback to creator initials if no group icon

             // Optional: find *first* other participant for secondary avatar in group view
             displayProfile = otherParticipants.length > 0 ? otherParticipants[0].profile : null;

         } else if (otherParticipants.length > 0) {
             displayProfile = otherParticipants[0].profile;
             if (displayProfile) {
                 displayName = `${displayProfile.first_name || ''} ${displayProfile.last_name || ''}`.trim() || 'Conversation';
                 avatarUrl = displayProfile.avatar_url;
                 avatarFallback = getInitials(displayProfile);
             } else {
                 // Handle case where profile might be missing for the other participant
                 displayName = sanitizeSubject(conversation.subject, 'Conversation');
                 avatarFallback = 'U'; // Unknown user
             }
         } else {
            // Conversation likely with self or data issue
            displayName = sanitizeSubject(conversation.subject, 'Notes to self'); // Or similar
            // Use current user's avatar
            avatarUrl = user.user_metadata?.avatar_url;
            avatarFallback = getInitials({first_name: user.user_metadata?.name?.split(' ')[0], last_name: user.user_metadata?.name?.split(' ')[1]});
         }


        return (
          <Card
            key={conversation.id}
            className={`hover:bg-ss-card-warm cursor-pointer transition-colors ${
              isUnread ? 'border-ss-peach-deep bg-ss-card-warm' : ''
            } ${
              selectedId === conversation.id ? 'bg-ss-card-warm border-ss-peach' : ''
            }`}
          >
            <button
              type="button"
              className="w-full text-left"
              onClick={() => onSelect(conversation.id)}
            >
              <div className="p-4">
                <div className="flex justify-between items-start gap-3">
                  <div className="flex gap-3 items-center flex-1 min-w-0">
                    {conversation.is_group ? (
                      <div className="relative h-10 w-10 shrink-0">
                         <Avatar className="h-10 w-10">
                            {/* Generic Group Icon or Creator Avatar */}
                            <AvatarImage src={avatarUrl || "https://api.dicebear.com/6.x/initials/svg?seed=Group"} />
                            <AvatarFallback className="bg-ss-warn-chip text-ss-warn">{avatarFallback}</AvatarFallback>
                          </Avatar>
                          {/* Optional: Small avatar for first other participant */}
                          {displayProfile && (
                            <Avatar className="h-6 w-6 absolute -bottom-1 -right-1 border-2 border-background">
                              <AvatarImage src={displayProfile.avatar_url} />
                              <AvatarFallback className="bg-ss-warn-chip text-ss-warn text-xs">
                                {getInitials(displayProfile)}
                              </AvatarFallback>
                            </Avatar>
                           )}
                      </div>
                    ) : (
                       <Avatar className="h-10 w-10 shrink-0">
                         <AvatarImage src={avatarUrl} />
                         <AvatarFallback className="bg-ss-warn-chip text-ss-warn">
                           {avatarFallback}
                         </AvatarFallback>
                       </Avatar>
                    )}
                    <div className="space-y-1 flex-1 min-w-0 text-left">
                      <p className={`font-medium line-clamp-1 text-foreground text-left ${isUnread ? 'font-semibold' : ''}`}>
                        {displayName}
                      </p>
                      <p className={`text-sm text-muted-foreground line-clamp-1 text-left ${isUnread ? 'font-medium' : ''}`}>
                        {conversation.last_message?.content || 'Start a conversation'}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end shrink-0"> {/* Prevent shrinking */}
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{timeAgo}</span> {/* Prevent wrapping */}
                    {isUnread && (
                      <span className="bg-ss-peach-deep text-white text-xs rounded-full px-2 py-0.5 mt-1">
                        New
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          </Card>
        );
      })}
    </div>
  );
};

export default ConversationList;
