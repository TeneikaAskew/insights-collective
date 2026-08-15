// ABOUTME: The user's messages — conversation list plus the open thread. Extracted from
// ABOUTME: the former standalone /messages page so it can render inside the Dashboard's
// ABOUTME: Messages tab and inside a course, next to the Calendar in both places.
//
// Deliberately renders no page chrome (no AppLayout, no <h1>): it is a panel, and the
// surrounding tab or page supplies the heading. Same contract as CalendarPanel, which is
// what lets both drop into the Dashboard without a nested layout or a duplicate title.
//
// Selection is a prop, not a route param. The panel is mounted at /dashboard?tab=messages
// and at /courses/:courseId/messages, neither of which has a :conversationId segment, so
// the open thread travels in the query string and the host decides what that looks like.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import ConversationList from '@/components/messages/ConversationList';
import MessageThread from '@/components/messages/MessageThread';
import MessageActions from '@/components/messages/MessageActions';
import MessageSuggestions from '@/components/messages/MessageSuggestions';
import { useConversationList } from '@/hooks/useConversationList';
import { useArchivedConversations } from '@/hooks/useArchivedConversations';
import { useDeletedConversations } from '@/hooks/useDeletedConversations';
import { useConversationMessages } from '@/hooks/useConversationMessages';
import { useConversationCourses } from '@/hooks/useConversationCourses';
import { useMessageSend } from '@/hooks/useMessageSend';

/**
 * How many times the course-scope map is re-read for a conversation whose course is
 * unknown, and how far apart. Three is enough for a row created moments ago to become
 * visible, and small enough that an id which resolves to nothing stops asking.
 */
const SCOPE_REFRESH_ATTEMPTS = 3;
const SCOPE_REFRESH_BACKOFF_MS = 400;

export const sanitizeSubject = (subject?: string | null, fallback = 'Conversation') =>
  !subject || /^(null\s*)+$/i.test(subject.trim()) ? fallback : subject;

interface MessagesPanelProps {
  /** The conversation to open, or undefined for the list. */
  conversationId?: string;
  /** Called with a conversation id to open it, or undefined to go back to the list. */
  onSelectConversation: (conversationId?: string) => void;
  /**
   * When set, only threads belonging to this course are listed. A course page shows
   * that course's messages; the Dashboard tab shows every course's.
   */
  courseId?: string;
  /** Rendered above the list — the course-scoped composer, usually. */
  actions?: React.ReactNode;
}

export function MessagesPanel({
  conversationId,
  onSelectConversation,
  courseId,
  actions,
}: MessagesPanelProps) {
  const { user } = useAuth();
  const [newMessage, setNewMessage] = useState('');
  const [activeTab, setActiveTab] = useState('inbox');

  const {
    conversations: inboxConversations,
    loading: inboxLoading,
    error: inboxError,
    refreshConversations: refreshInbox,
  } = useConversationList();
  const {
    conversations: archivedConversations,
    loading: archivedLoading,
    error: archivedError,
    refreshConversations: refreshArchived,
  } = useArchivedConversations();
  const {
    conversations: deletedConversations,
    loading: deletedLoading,
    error: deletedError,
    refreshConversations: refreshDeleted,
  } = useDeletedConversations();

  const { messages, loading: messagesLoading } = useConversationMessages(conversationId);
  const { sendMessage, sending } = useMessageSend();

  // A course page must not leak the user's other courses into its list. Filtering here
  // rather than in the hooks keeps the three list hooks (and their realtime channels)
  // shared between both surfaces — the Dashboard tab wants the unfiltered set.
  const {
    courseByConversation,
    loading: scopeLoading,
    error: scopeError,
    refresh: refreshScope,
  } = useConversationCourses();

  // Filtering the list is not the same as scoping the page.
  //
  // The open thread arrives in ?conversation=, which anyone can edit, and
  // useConversationMessages loads it by id. RLS still applies — you can only ever
  // open a thread you are a participant of, so this is not a leak — but a user in
  // two courses could put a course-B thread id on the course-A page and read and
  // reply to it there, under course A's heading. That contradicts what the page
  // says it is showing.
  const openThreadScopeKnown =
    !!conversationId && Object.prototype.hasOwnProperty.call(courseByConversation, conversationId);
  const openThreadOutOfScope =
    !!courseId && !!conversationId && openThreadScopeKnown && courseByConversation[conversationId] !== courseId;

  // A thread the map has never heard of is usually one that was just created by
  // the composer on this very page, so re-read the mapping before judging it.
  //
  // Bounded RETRIES rather than a single attempt, and the difference is a bug that
  // reached production. This asked exactly once per id and then recorded the id as
  // asked — so if that one read landed before the new conversation was visible to
  // it, the mapping never filled and `scopeToCourse` filtered the thread out of the
  // list for good. The symptom was a thread you could read and reply to that was
  // missing from the sidebar next to it, until a reload. e2e caught it as "the new
  // thread never reached the conversation list in-page".
  //
  // One attempt was too few for a row created a moment ago; unlimited attempts are
  // the thing the original guard was right to avoid, because an id that genuinely
  // resolves to nothing (someone else's thread pasted into the URL) would poll
  // forever. A small ceiling with a short backoff keeps both properties.
  // The retries must OUTLIVE the open thread, which is why they are not cleaned up
  // per-effect-run. Codex caught the first version doing exactly that: the immediate
  // read misses, a backed-off retry is scheduled, the user presses Back, clearing
  // `conversationId` re-runs the effect, and its cleanup cancels the pending timer.
  // The effect then refuses to schedule anything more, because it requires an open
  // conversation — so the map stays stale and the conversation stays filtered out
  // until a reload. That is the very race this is here to repair, surviving in a
  // narrower window.
  //
  // So on the first miss the whole remaining sequence is scheduled at once, and the
  // timers are cleared only on unmount. refreshScope is idempotent, so a retry that
  // turns out to be unnecessary costs one read.
  const scheduledFor = useRef(new Set<string>());
  const pendingTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(
    () => () => {
      pendingTimers.current.forEach(clearTimeout);
      pendingTimers.current = [];
    },
    [],
  );

  useEffect(() => {
    if (!courseId || !conversationId || scopeLoading || openThreadScopeKnown) return;
    if (scheduledFor.current.has(conversationId)) return;
    scheduledFor.current.add(conversationId);

    // Immediately, because the common case is a map that is merely stale...
    refreshScope();

    // ...then a bounded, backed-off tail for the case it is not. Unlimited retries
    // are what the original single-shot guard was right to avoid: an id that
    // genuinely resolves to nothing — someone else's thread pasted into
    // ?conversation= — would otherwise poll forever.
    for (let attempt = 1; attempt < SCOPE_REFRESH_ATTEMPTS; attempt += 1) {
      const timer = setTimeout(() => {
        pendingTimers.current = pendingTimers.current.filter((t) => t !== timer);
        refreshScope();
      }, attempt * SCOPE_REFRESH_BACKOFF_MS);
      pendingTimers.current.push(timer);
    }
  }, [courseId, conversationId, scopeLoading, openThreadScopeKnown, refreshScope]);

  // `course_id` is stamped onto each row on the way through, not just used to filter:
  // ConversationList keys its 1:1 deduplication on it, because the same student and
  // instructor can have one thread per shared course and those must not collapse.
  const scopeToCourse = useMemo(
    () => (conversations: any[]) =>
      conversations
        .map((conv) => ({ ...conv, course_id: courseByConversation[conv?.id] ?? null }))
        .filter((conv) => (courseId ? conv.course_id === courseId : true)),
    [courseId, courseByConversation],
  );

  // A thread with no messages yet is listed only for people who chose to be in it: the
  // person who started it, or a participant who explicitly opened it themselves. Both
  // need a way back in to write the first message. To anyone else it is a "Start a
  // conversation" row from somebody who never wrote anything, which reads as a bug
  // (and was reported as one). It appears for them when the first message does.
  //
  // "Opened it themselves" matters because open_course_thread reuses an existing empty
  // thread regardless of who created it — the non-creator can land in one via the
  // composer, and `created_by` alone would hide it from them again the moment they
  // backed out. Session storage, not persistence: after this browser session the
  // empty thread they abandoned goes back to being the creator's alone.
  const openedThreadsKey = user ? `messages:opened-threads:${user.id}` : null;

  useEffect(() => {
    if (!openedThreadsKey || !conversationId) return;
    try {
      const opened = new Set<string>(JSON.parse(sessionStorage.getItem(openedThreadsKey) ?? '[]'));
      if (!opened.has(conversationId)) {
        opened.add(conversationId);
        sessionStorage.setItem(openedThreadsKey, JSON.stringify([...opened]));
      }
    } catch {
      // Storage unavailable — the creator rule below still applies.
    }
  }, [openedThreadsKey, conversationId]);

  const hideUnstartedForeign = useMemo(() => {
    let opened = new Set<string>();
    try {
      if (openedThreadsKey) {
        opened = new Set<string>(JSON.parse(sessionStorage.getItem(openedThreadsKey) ?? '[]'));
      }
    } catch {
      // Unreadable storage falls back to the creator rule.
    }
    return (conversations: any[]) =>
      conversations.filter(
        (conv) => conv?.last_message || conv?.created_by === user?.id || opened.has(conv?.id),
      );
    // conversationId is a dependency so the set is re-read after the effect above
    // records a newly opened thread — by the time the user is back on the list.
  }, [openedThreadsKey, user?.id, conversationId]);

  const inbox = hideUnstartedForeign(scopeToCourse(inboxConversations));
  const archived = hideUnstartedForeign(scopeToCourse(archivedConversations));
  const deleted = hideUnstartedForeign(scopeToCourse(deletedConversations));

  // On a course page the scoping read is part of the answer, so its loading and failure
  // states are the list's. Treating a failed read as "no threads" would show a confident
  // empty inbox while hiding real messages.
  const scopingList = courseId;
  const listLoading = (base: boolean) => base || (scopingList ? scopeLoading : false);
  const listError = (base: unknown) => base ?? (scopingList ? scopeError : null);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !conversationId || !user) return;

    const success = await sendMessage(conversationId, newMessage.trim());
    if (success) {
      setNewMessage('');
    }
  };

  const handleConversationAction = (actionType: 'archive' | 'unarchive' | 'delete' | 'restore') => {
    switch (actionType) {
      case 'archive':
        refreshInbox();
        refreshArchived();
        break;
      case 'unarchive':
        refreshArchived();
        refreshInbox();
        break;
      case 'delete':
        refreshInbox();
        refreshArchived();
        refreshDeleted();
        break;
      case 'restore':
        refreshDeleted();
        refreshInbox();
        break;
    }

    onSelectConversation(undefined);
  };

  // Refuse to render a thread that belongs to another course under this course's
  // heading. Not an error card: the thread is perfectly real and the user is
  // entitled to it, just not here, so point at where it lives.
  if (conversationId && openThreadOutOfScope) {
    return (
      <div className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onSelectConversation(undefined)}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Messages
        </Button>
        <Card className="p-6">
          <h3 className="text-lg font-semibold">That conversation is about a different course</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            This page only shows messages for the course you are in. Open it from the course it
            belongs to, or from Messages on your dashboard.
          </p>
        </Card>
      </div>
    );
  }

  if (conversationId) {
    // Look the conversation up across every list, not just the scoped one: a thread can be
    // opened from a course page and then archived, and the header still has to name it.
    const currentConversation = [
      ...inboxConversations,
      ...archivedConversations,
      ...deletedConversations,
    ].find((conv) => conv.id === conversationId);
    const isArchived = archivedConversations.some((conv) => conv.id === conversationId);
    const isDeleted = deletedConversations.some((conv) => conv.id === conversationId);

    return (
      <div className="space-y-4">
        <div className="flex items-start gap-2 min-w-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onSelectConversation(undefined)}
            className="flex items-center gap-2 shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back to Messages</span>
            <span className="sm:hidden">Back</span>
          </Button>
          <div className="min-w-0">
            <h3 className="text-lg sm:text-xl font-semibold tracking-tight truncate">
              {sanitizeSubject(currentConversation?.subject)}
            </h3>
            <p className="text-sm text-muted-foreground">
              {isDeleted ? 'Deleted conversation' : isArchived ? 'Archived conversation' : 'Active conversation'}
            </p>
          </div>
        </div>

        <Card className="h-[calc(100dvh-13rem)] min-h-[24rem] sm:h-[calc(100vh-16rem)] sm:min-h-[600px] sm:max-h-[56rem] flex flex-col">
          <MessageActions
            conversationId={conversationId}
            onSuccess={handleConversationAction}
            isArchived={isArchived}
            isDeleted={isDeleted}
            currentTab={isDeleted ? 'deleted' : isArchived ? 'archived' : 'inbox'}
          />

          <div className="flex-1 overflow-hidden">
            <MessageThread messages={messages} loading={messagesLoading} />
          </div>

          {!isDeleted && (
            <MessageSuggestions
              onSelectMessage={setNewMessage}
              conversationId={conversationId}
              messages={messages}
            />
          )}

          {!isDeleted && (
            <div className="p-4 border-t">
              <form onSubmit={handleSendMessage} className="flex space-x-2">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type your message..."
                  disabled={sending}
                  aria-label="Message"
                  className="flex-1"
                />
                <Button type="submit" disabled={sending || !newMessage.trim()}>
                  <Send className="h-4 w-4" />
                  <span className="sr-only">Send</span>
                </Button>
              </form>
            </div>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {actions && <div className="flex justify-start sm:justify-end">{actions}</div>}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="inbox">Inbox</TabsTrigger>
          <TabsTrigger value="archived">Archived</TabsTrigger>
          <TabsTrigger value="deleted">Deleted</TabsTrigger>
        </TabsList>

        <TabsContent value="inbox" className="mt-6">
          <ConversationList
            conversations={inbox}
            loading={listLoading(inboxLoading)}
            error={listError(inboxError)}
            selectedId={conversationId}
            onSelect={onSelectConversation}
          />
        </TabsContent>

        <TabsContent value="archived" className="mt-6">
          <ConversationList
            conversations={archived}
            loading={listLoading(archivedLoading)}
            error={listError(archivedError)}
            selectedId={conversationId}
            onSelect={onSelectConversation}
          />
        </TabsContent>

        <TabsContent value="deleted" className="mt-6">
          <ConversationList
            conversations={deleted}
            loading={listLoading(deletedLoading)}
            error={listError(deletedError)}
            selectedId={conversationId}
            onSelect={onSelectConversation}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default MessagesPanel;
