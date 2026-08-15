// ABOUTME: Tests for MessagesPanel — the shared surface behind the Dashboard's Messages tab
// ABOUTME: and each course's Messages page: list vs thread, course scoping, and send.
//
// The scoping tests are the point of this file. A course page that quietly shows another
// course's threads leaks a conversation the viewer was not meant to see in that context,
// and one that quietly shows nothing when the scoping read fails hides a real message —
// both look like a perfectly ordinary inbox from the outside.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test/utils/test-utils';
import { MessagesPanel } from '../MessagesPanel';
import { useConversationList } from '@/hooks/useConversationList';
import { useArchivedConversations } from '@/hooks/useArchivedConversations';
import { useDeletedConversations } from '@/hooks/useDeletedConversations';
import { useConversationMessages } from '@/hooks/useConversationMessages';
import { useConversationCourses } from '@/hooks/useConversationCourses';
import { useMessageSend } from '@/hooks/useMessageSend';
import { useAuth } from '@/contexts/AuthContext';

vi.mock('@/hooks/useConversationList', () => ({ useConversationList: vi.fn() }));
vi.mock('@/hooks/useArchivedConversations', () => ({ useArchivedConversations: vi.fn() }));
vi.mock('@/hooks/useDeletedConversations', () => ({ useDeletedConversations: vi.fn() }));
vi.mock('@/hooks/useConversationMessages', () => ({ useConversationMessages: vi.fn() }));
vi.mock('@/hooks/useConversationCourses', () => ({ useConversationCourses: vi.fn() }));
vi.mock('@/hooks/useMessageSend', () => ({ useMessageSend: vi.fn() }));

vi.mock('@/components/messages/MessageActions', () => ({
  default: () => <div data-testid="message-actions" />,
}));
vi.mock('@/components/messages/MessageSuggestions', () => ({
  default: () => <div data-testid="message-suggestions" />,
}));

const DATA_SCIENCE = 'course-data-science';
const MACHINE_LEARNING = 'course-machine-learning';

const conversation = (id: string, otherName: string) => ({
  id,
  subject: null,
  is_group: false,
  created_by: 'user-1',
  created_at: '2026-08-01T00:00:00Z',
  updated_at: '2026-08-01T00:00:00Z',
  participants: [
    { user_id: 'user-1', profile: { id: 'user-1', first_name: 'Me', last_name: 'Myself' } },
    { user_id: 'user-2', profile: { id: 'user-2', first_name: otherName, last_name: 'Teacher' } },
  ],
  last_message: { id: 'm1', content: `about ${otherName}`, created_at: '2026-08-01T00:00:00Z', read: true, sender_id: 'user-2' },
});

const DS_THREAD = conversation('conv-ds', 'Ada');
const ML_THREAD = conversation('conv-ml', 'Grace');

const sendMessage = vi.fn();
const refreshScope = vi.fn();

function setLists({
  inbox = [DS_THREAD, ML_THREAD],
  scoping = { 'conv-ds': DATA_SCIENCE, 'conv-ml': MACHINE_LEARNING },
  scopeLoading = false,
  scopeError = null as unknown,
} = {}) {
  vi.mocked(useConversationList).mockReturnValue({
    conversations: inbox,
    loading: false,
    error: null,
    refreshConversations: vi.fn(),
  } as any);
  vi.mocked(useArchivedConversations).mockReturnValue({
    conversations: [], loading: false, error: null, refreshConversations: vi.fn(),
  } as any);
  vi.mocked(useDeletedConversations).mockReturnValue({
    conversations: [], loading: false, error: null, refreshConversations: vi.fn(),
  } as any);
  vi.mocked(useConversationCourses).mockReturnValue({
    courseByConversation: scoping,
    loading: scopeLoading,
    error: scopeError,
    refresh: refreshScope,
  } as any);
}

describe('MessagesPanel', () => {
  beforeEach(() => {
    sessionStorage.clear();
    sendMessage.mockReset().mockResolvedValue(true);
    refreshScope.mockReset();
    vi.mocked(useAuth).mockReturnValue({ user: { id: 'user-1' } } as any);
    vi.mocked(useConversationMessages).mockReturnValue({ messages: [], loading: false } as any);
    vi.mocked(useMessageSend).mockReturnValue({ sendMessage, sending: false } as any);
    setLists();
  });

  it('lists every course thread when no course is given (the Dashboard tab)', () => {
    render(<MessagesPanel onSelectConversation={vi.fn()} />);

    expect(screen.getByText('Ada Teacher')).toBeInTheDocument();
    expect(screen.getByText('Grace Teacher')).toBeInTheDocument();
  });

  it('lists only that course\'s threads when a course is given', () => {
    render(<MessagesPanel courseId={DATA_SCIENCE} onSelectConversation={vi.fn()} />);

    expect(screen.getByText('Ada Teacher')).toBeInTheDocument();
    // The machine-learning thread belongs to a course this page is not about.
    expect(screen.queryByText('Grace Teacher')).not.toBeInTheDocument();
  });

  /**
   * A failed scoping read must not read as "no messages in this course". Those are the
   * same screen, and only one of them is true.
   */
  it('surfaces an error rather than an empty course inbox when scoping fails', () => {
    setLists({ scopeError: new Error('scoping read failed') });

    render(<MessagesPanel courseId={DATA_SCIENCE} onSelectConversation={vi.fn()} />);

    expect(screen.getByText(/error loading conversations/i)).toBeInTheDocument();
    expect(screen.queryByText(/no conversations yet/i)).not.toBeInTheDocument();
  });

  it('does not apply the scoping error to the unscoped Dashboard tab', () => {
    setLists({ scopeError: new Error('scoping read failed') });

    render(<MessagesPanel onSelectConversation={vi.fn()} />);

    expect(screen.queryByText(/error loading conversations/i)).not.toBeInTheDocument();
    expect(screen.getByText('Ada Teacher')).toBeInTheDocument();
  });

  /**
   * A thread with no messages yet is listed only for its creator, who needs a way
   * back to it to write the first message. To anybody else it is a "Start a
   * conversation" row from somebody who never wrote — which got reported as a bug.
   */
  it('lists a message-less thread for its creator but not for the other participant', () => {
    const mineEmpty = { ...conversation('conv-mine-empty', 'Pending'), last_message: null };
    const theirsEmpty = {
      ...conversation('conv-theirs-empty', 'Silent'),
      created_by: 'user-2',
      last_message: null,
    };
    const theirsStarted = { ...conversation('conv-theirs-started', 'Vocal'), created_by: 'user-2' };
    setLists({
      inbox: [mineEmpty, theirsEmpty, theirsStarted],
      // Distinct courses per thread: the list dedupes 1:1 threads on the pair+course
      // key, and all three share the same pair.
      scoping: {
        'conv-mine-empty': DATA_SCIENCE,
        'conv-theirs-empty': MACHINE_LEARNING,
        'conv-theirs-started': 'course-statistics',
      },
    });

    render(<MessagesPanel onSelectConversation={vi.fn()} />);

    // I started this one — it stays reachable so I can send the first message.
    expect(screen.getByText('Pending Teacher')).toBeInTheDocument();
    // Someone opened a thread with me and never wrote: not inbox material yet.
    expect(screen.queryByText('Silent Teacher')).not.toBeInTheDocument();
    // The moment a message exists, it is a real conversation regardless of creator.
    expect(screen.getByText('Vocal Teacher')).toBeInTheDocument();
  });

  /**
   * open_course_thread reuses an existing empty thread regardless of creator, so the
   * non-creator can land in one through the composer. Having explicitly opened it,
   * they need the same way back in as the creator — for this browser session.
   */
  it('keeps an empty thread visible for a participant who explicitly opened it', () => {
    sessionStorage.setItem('messages:opened-threads:user-1', JSON.stringify(['conv-reopened']));
    const reopened = {
      ...conversation('conv-reopened', 'Silent'),
      created_by: 'user-2',
      last_message: null,
    };
    setLists({ inbox: [reopened], scoping: { 'conv-reopened': DATA_SCIENCE } });

    render(<MessagesPanel onSelectConversation={vi.fn()} />);

    expect(screen.getByText('Silent Teacher')).toBeInTheDocument();
  });

  it('records an open thread so it survives backing out while still empty', () => {
    render(<MessagesPanel conversationId="conv-ds" onSelectConversation={vi.fn()} />);

    expect(JSON.parse(sessionStorage.getItem('messages:opened-threads:user-1') ?? '[]')).toContain(
      'conv-ds',
    );
  });

  it('reports the clicked conversation to its host instead of navigating to /messages/:id', () => {
    const onSelect = vi.fn();
    render(<MessagesPanel onSelectConversation={onSelect} />);

    fireEvent.click(screen.getByText('Ada Teacher'));

    expect(onSelect).toHaveBeenCalledWith('conv-ds');
  });

  it('renders the thread and sends a message when a conversation is open', async () => {
    vi.mocked(useConversationMessages).mockReturnValue({
      messages: [
        {
          id: 'm1',
          sender_id: 'user-2',
          conversation_id: 'conv-ds',
          content: 'Hello from your instructor',
          read: false,
          created_at: '2026-08-01T00:00:00Z',
          sender: { id: 'user-2', first_name: 'Ada', last_name: 'Teacher', roles: ['instructor'] },
        },
      ],
      loading: false,
    } as any);

    render(<MessagesPanel conversationId="conv-ds" onSelectConversation={vi.fn()} />);

    expect(screen.getByText('Hello from your instructor')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Thanks!' } });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => expect(sendMessage).toHaveBeenCalledWith('conv-ds', 'Thanks!'));
  });

  /**
   * Filtering the list is not the same as scoping the page. ?conversation= is editable,
   * and useConversationMessages loads whatever id it is given. RLS still means you can
   * only open a thread you are in — so this is not a leak — but a user in two courses
   * could read and reply to a course-B thread under course A's heading.
   */
  it('refuses to open a thread belonging to another course', () => {
    render(
      <MessagesPanel
        courseId={DATA_SCIENCE}
        conversationId="conv-ml"
        onSelectConversation={vi.fn()}
      />,
    );

    expect(screen.getByText(/about a different course/i)).toBeInTheDocument();
    expect(screen.queryByLabelText('Message')).not.toBeInTheDocument();
  });

  it('opens a thread that does belong to this course', () => {
    render(
      <MessagesPanel
        courseId={DATA_SCIENCE}
        conversationId="conv-ds"
        onSelectConversation={vi.fn()}
      />,
    );

    expect(screen.queryByText(/about a different course/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Message')).toBeInTheDocument();
  });

  it('opens any thread on the unscoped Dashboard tab', () => {
    render(<MessagesPanel conversationId="conv-ml" onSelectConversation={vi.fn()} />);

    expect(screen.queryByText(/about a different course/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Message')).toBeInTheDocument();
  });

  /**
   * The map is a snapshot taken at mount. The composer creates a thread while the page
   * is already open, so a thread the map has never heard of is usually one that was just
   * started here — re-read before deciding it belongs elsewhere, or the user is told
   * their brand-new conversation is about a different course.
   */
  it('re-reads the scoping for a thread it has never seen, instead of rejecting it', () => {
    render(
      <MessagesPanel
        courseId={DATA_SCIENCE}
        conversationId="conv-brand-new"
        onSelectConversation={vi.fn()}
      />,
    );

    expect(refreshScope).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/about a different course/i)).not.toBeInTheDocument();
  });

  it('goes back to the list by clearing the host selection', () => {
    const onSelect = vi.fn();
    render(<MessagesPanel conversationId="conv-ds" onSelectConversation={onSelect} />);

    fireEvent.click(screen.getByRole('button', { name: /back/i }));

    expect(onSelect).toHaveBeenCalledWith(undefined);
  });
});
