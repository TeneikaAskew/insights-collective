import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow } from 'date-fns';
import { AlertCircle, ArchiveRestore, Archive, Trash2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { ConversationParticipant, Profile } from '@/types/supabase';
import { supabase } from '@/integrations/supabase/client';

const ConversationList = ({ isArchived = false, onRestore }) => {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchConversations = async () => {
      setLoading(true);
      const filter = isArchived ? { archived: true } : { deleted_at: null, archived: false };
      const { data, error } = await supabase
        .from('conversations')
        .select('*, participants:conversation_participants(*, profile:profiles(*)), last_message:messages!last_message_id(*)')
        .match(filter)
        .order('updated_at', { ascending: false });
      if (error) setError(error);
      else setConversations(data || []);
      setLoading(false);
    };
    fetchConversations();
  }, [isArchived]);

  const handleAction = async (e, conversationId, type) => {
    e.preventDefault();
    e.stopPropagation();
    let updateObj = {};
    if (type === 'archive') updateObj = { archived: true };
    if (type === 'delete') updateObj = { deleted_at: new Date().toISOString() };

    const { error } = await supabase
      .from('conversations')
      .update(updateObj)
      .eq('id', conversationId);

    if (error) {
      toast({ variant: 'destructive', description: `Failed to ${type} conversation` });
    } else {
      toast({ description: `Conversation ${type}d successfully` });
      setConversations(prev => prev.filter(c => c.id !== conversationId));
    }
  };

  const handleRestore = async (e, id) => {
    e.preventDefault();
    e.stopPropagation();
    if (onRestore) await onRestore(id);
  };

  const getInitials = (profile) => {
    const f = profile?.first_name || '';
    const l = profile?.last_name || '';
    return f && l ? f[0] + l[0] : f || l || 'U';
  };

  if (error) {
    return <Alert variant="destructive" className="mb-4"><AlertCircle className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{error.message}</AlertDescription></Alert>;
  }

  if (loading) {
    return <div className="space-y-2">{[1, 2, 3].map(i => <Card key={i} className="p-4"><div className="flex gap-3"><Skeleton className="h-12 w-12 rounded-full" /><div className="flex-1"><Skeleton className="h-4 w-3/4 mb-2" /><Skeleton className="h-3 w-1/2" /></div></div></Card>)}</div>;
  }

  if (!conversations.length) {
    return <div className="text-center p-6 border rounded-md bg-amber-50 border-amber-200"><p className="text-amber-800 mb-2 font-medium">{isArchived ? 'No archived conversations' : 'No conversations yet'}</p><p className="text-sm text-amber-700">{isArchived ? 'Archived conversations will appear here' : 'Start a new conversation to connect with others.'}</p></div>;
  }

  return <div className="space-y-2 h-full overflow-auto">{conversations.map((c) => {
    const participants = c.participants || [];
    const others = participants.filter(p => p.user_id !== c.created_by);
    const currentUser = participants.find(p => p.user_id === user?.id);
    const p = others[0]?.profile;
    const timeAgo = formatDistanceToNow(new Date(c.last_message?.created_at || c.updated_at), { addSuffix: true });
    const unread = c.last_message && !c.last_message.read && c.last_message.sender_id !== c.created_by;

    return <div key={c.id} className="conversation-card">
      <Link to={`/messages/${c.id}`} onClick={(e) => { e.preventDefault(); navigate(`/messages/${c.id}`); }}>
        <Card className={`p-4 hover:bg-amber-50/50 cursor-pointer transition-colors ${conversationId === c.id ? 'bg-amber-50 border-amber-200' : ''} group`}>
          <div className="flex justify-between items-start gap-3">
            <div className="flex gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={p?.avatar_url || ''} alt={`${p?.first_name} ${p?.last_name}`} />
                <AvatarFallback className="bg-amber-100 text-amber-800">{getInitials(p)}</AvatarFallback>
              </Avatar>
              <div className="space-y-1">
                <p className="font-medium line-clamp-1 text-gray-800">{c.subject || (p?.first_name ? `${p.first_name} ${p.last_name}` : 'Unknown User')}</p>
                <p className="text-sm text-gray-600 line-clamp-1">{c.last_message?.content || 'Start a conversation'}</p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="text-xs text-gray-500">{timeAgo}</span>
              {unread && <span className="bg-amber-500 text-white text-xs rounded-full px-2 py-0.5">1</span>}
              <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
                {isArchived ? (
                  <Button variant="ghost" size="sm" onClick={(e) => handleRestore(e, c.id)} className="p-1 h-7 w-7" title="Restore"><ArchiveRestore className="h-4 w-4" /></Button>
                ) : (
                  <>
                    <Button variant="ghost" size="sm" onClick={(e) => handleAction(e, c.id, 'archive')} className="p-1 h-7 w-7" title="Archive"><Archive className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={(e) => handleAction(e, c.id, 'delete')} className="p-1 h-7 w-7 text-red-500 hover:text-red-700" title="Delete"><Trash2 className="h-4 w-4" /></Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </Card>
      </Link>
    </div>;
  })}</div>;
};

export default ConversationList;
