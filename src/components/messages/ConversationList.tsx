import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useParams } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow } from 'date-fns';
import { AlertCircle, ArchiveRestore, Archive, Trash2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { ConversationParticipant, Profile } from '@/types/supabase';
import { supabase } from '@/integrations/supabase/client';

interface ConversationListProps {
  conversations: any[];
  loading: boolean;
  error?: any;
  isArchived?: boolean;
  onRestore?: (conversationId: string) => Promise<void>;
}

const ConversationList: React.FC<ConversationListProps> = ({ 
  conversations = [], 
  loading, 
  error,
  isArchived = false,
  onRestore 
}) => {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleRestore = async (e: React.MouseEvent, conversationId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (onRestore) {
      try {
        await onRestore(conversationId);
        toast({
          description: "Conversation restored successfully",
        });
      } catch (error) {
        toast({
          variant: "destructive",
          description: "Failed to restore conversation",
        });
      }
    }
  };

  const handleArchive = async (e: React.MouseEvent, conversationId: string) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await supabase
        .from('conversations')
        .update({ archived: true })
        .eq('id', conversationId);
      
      // Filter out the archived conversation from the current view instead of reloading
      const element = e.currentTarget.closest('.conversation-card');
      if (element) {
        element.style.display = 'none';
      }
      
      toast({
        description: "Conversation archived successfully",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        description: "Failed to archive conversation",
      });
    }
  };

  const handleDelete = async (e: React.MouseEvent, conversationId: string) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const now = new Date().toISOString();
      await supabase
        .from('conversations')
        .update({ deleted_at: now })
        .eq('id', conversationId);
      
      // Filter out the deleted conversation from the current view instead of reloading
      const element = e.currentTarget.closest('.conversation-card');
      if (element) {
        element.style.display = 'none';
      }
      
      toast({
        description: "Conversation deleted successfully",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        description: "Failed to delete conversation",
      });
    }
  };
  
  // Helper function to get participant initials
  const getInitials = (profile: Profile | undefined): string => {
    if (!profile) return 'U';
    const firstName = profile.first_name || '';
    const lastName = profile.last_name || '';
    
    if (firstName && lastName) {
      return `${firstName[0]}${lastName[0]}`;
    } else if (firstName) {
      return firstName[0];
    } else if (lastName) {
      return lastName[0];
    } else {
      return 'U';
    }
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

  if (!conversations || conversations.length === 0) {
    return (
      <div className="text-center p-6 border rounded-md bg-amber-50 border-amber-200">
        <p className="text-amber-800 mb-2 font-medium">
          {isArchived ? 'No archived conversations' : 'No conversations yet'}
        </p>
        <p className="text-sm text-amber-700">
          {isArchived 
            ? 'Archived conversations will appear here' 
            : 'Start a new conversation to connect with instructors and classmates.'
          }
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 h-full overflow-auto">
      {conversations.map((conversation) => {
        if (!conversation) return null;
        
        const participants = conversation.participants || [];
        const otherParticipants = participants.filter(
          (p: any) => p && p.user_id !== conversation.created_by
        );
        
        let timeAgo = '';
        try {
          if (conversation.last_message?.created_at) {
            timeAgo = formatDistanceToNow(new Date(conversation.last_message.created_at), { addSuffix: true });
          } else if (conversation.updated_at) {
            timeAgo = formatDistanceToNow(new Date(conversation.updated_at), { addSuffix: true });
          }
        } catch (error) {
          console.error('Error formatting date:', error);
          timeAgo = 'Recently';
        }

        const unreadCount = conversation.last_message && 
                          !conversation.last_message.read && 
                          conversation.last_message.sender_id !== conversation.created_by ? 1 : 0;

        // Group avatar display handler
        const renderGroupAvatar = () => (
          <div className="relative flex flex-wrap w-10 h-10">
            {otherParticipants.slice(0, 4).map((participant: ConversationParticipant, index: number) => (
              <div 
                key={participant.id} 
                className={`${
                  otherParticipants.length === 1 ? 'w-10 h-10' : 
                  otherParticipants.length <= 2 ? 'w-8 h-8' : 'w-5 h-5'
                } ${
                  index === 0 && otherParticipants.length > 1 ? 'absolute top-0 left-0' :
                  index === 1 && otherParticipants.length > 1 ? 'absolute top-0 right-0' :
                  index === 2 && otherParticipants.length > 2 ? 'absolute bottom-0 left-0' :
                  'absolute bottom-0 right-0'
                }`}
              >
                <Avatar className="w-full h-full border border-white">
                  <AvatarImage 
                    src={participant.profile?.avatar_url || ''} 
                    alt={`${participant.profile?.first_name || ''} ${participant.profile?.last_name || ''}`}
                  />
                  <AvatarFallback className="bg-amber-100 text-amber-800 text-xs">
                    {getInitials(participant.profile)}
                  </AvatarFallback>
                </Avatar>
              </div>
            ))}
          </div>
        );

        return (
          <div key={conversation.id} className="conversation-card">
            <Link
              to={`/messages/${conversation.id}`}
              onClick={(e) => {
                e.preventDefault();
                navigate(`/messages/${conversation.id}`);
              }}
            >
              <Card
                className={`p-4 hover:bg-amber-50/50 cursor-pointer transition-colors ${
                  conversationId === conversation.id ? 'bg-amber-50 border-amber-200' : ''
                } group`}
              >
                <div className="flex justify-between items-start gap-3">
                  <div className="flex gap-3">
                    {conversation.is_group ? (
                      renderGroupAvatar()
                    ) : (
                      <Avatar className="h-10 w-10">
                        <AvatarImage 
                          src={otherParticipants[0]?.profile?.avatar_url || ''} 
                          alt={`${otherParticipants[0]?.profile?.first_name || ''} ${otherParticipants[0]?.profile?.last_name || ''}`}
                        />
                        <AvatarFallback className="bg-amber-100 text-amber-800">
                          {getInitials(otherParticipants[0]?.profile)}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div className="space-y-1">
                      <p className="font-medium line-clamp-1 text-gray-800">
                        {conversation.subject || 
                          (conversation.is_group 
                            ? `Group (${participants.length} participants)` 
                            : otherParticipants[0]?.profile?.first_name
                              ? `${otherParticipants[0]?.profile?.first_name} ${otherParticipants[0]?.profile?.last_name || ''}`
                              : 'Unknown User'
                          )
                        }
                      </p>
                      <p className="text-sm text-gray-600 line-clamp-1">
                        {conversation.last_message?.content || 'Start a conversation'}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-xs text-gray-500">{timeAgo}</span>
                    {unreadCount > 0 && (
                      <span className="bg-amber-500 text-white text-xs rounded-full px-2 py-0.5">
                        {unreadCount}
                      </span>
                    )}
                    <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
                      {isArchived ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => handleRestore(e, conversation.id)}
                          className="p-1 h-7 w-7"
                          title="Restore conversation"
                        >
                          <ArchiveRestore className="h-4 w-4" />
                        </Button>
                      ) : (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => handleArchive(e, conversation.id)}
                            className="p-1 h-7 w-7"
                            title="Archive conversation"
                          >
                            <Archive className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => handleDelete(e, conversation.id)}
                            className="p-1 h-7 w-7 text-red-500 hover:text-red-700"
                            title="Delete conversation"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            </Link>
          </div>
        );
      })}
    </div>
  );
};

export default ConversationList;