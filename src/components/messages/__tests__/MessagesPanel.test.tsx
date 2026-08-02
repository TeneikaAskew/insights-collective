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
  } as any);
}

describe('MessagesPanel', () => {
  beforeEach(() => {
    sendMessage.mockReset().mockResolvedValue(true);
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

  it('goes back to the list by clearing the host selection', () => {
    const onSelect = vi.fn();
    render(<MessagesPanel conversationId="conv-ds" onSelectConversation={onSelect} />);

    fireEvent.click(screen.getByRole('button', { name: /back/i }));

    expect(onSelect).toHaveBeenCalledWith(undefined);
  });
});
