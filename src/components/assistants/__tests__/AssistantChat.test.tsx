import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test/utils/test-utils';
import AssistantChat from '../AssistantChat';
import { useAssistantChat } from '@/hooks/useAssistantChat';

// Mock hooks and dependencies
vi.mock('@/hooks/useAssistantChat');
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'user123', email: 'test@example.com' },
    isAuthenticated: true,
  }),
}));

const mockAssistant = {
  id: 'asst1',
  name: 'Career Coach',
  description: 'AI Career Advisor',
  avatar: '👨‍💼',
  systemPrompt: 'You are a career coach',
  category: 'career',
};

describe('AssistantChat', () => {
  const mockSendMessage = vi.fn();
  const mockMessages = [
    {
      id: '1',
      role: 'assistant',
      content: 'Hello! How can I help you today?',
      timestamp: new Date().toISOString(),
    },
    {
      id: '2',
      role: 'user',
      content: 'I need career advice',
      timestamp: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAssistantChat).mockReturnValue({
      messages: mockMessages,
      loading: false,
      sendMessage: mockSendMessage,
      error: null,
      clearMessages: vi.fn(),
      retryLastMessage: vi.fn(),
    } as any);
  });

  it('should render assistant chat interface', () => {
    render(<AssistantChat assistant={mockAssistant} />);
    
    expect(screen.getByText('Career Coach')).toBeInTheDocument();
    expect(screen.getByText('Hello! How can I help you today?')).toBeInTheDocument();
    expect(screen.getByText('I need career advice')).toBeInTheDocument();
  });

  it('should send a message', async () => {
    render(<AssistantChat assistant={mockAssistant} />);
    
    const input = screen.getByPlaceholderText(/type your message/i);
    const sendButton = screen.getByRole('button', { name: /send/i });
    
    fireEvent.change(input, { target: { value: 'What careers suit my skills?' } });
    fireEvent.click(sendButton);
    
    await waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalledWith('What careers suit my skills?');
    });
  });

  it('should handle empty message', async () => {
    render(<AssistantChat assistant={mockAssistant} />);
    
    const sendButton = screen.getByRole('button', { name: /send/i });
    fireEvent.click(sendButton);
    
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it('should show loading state', () => {
    vi.mocked(useAssistantChat).mockReturnValue({
      ...vi.mocked(useAssistantChat).mock.results[0].value,
      loading: true,
    } as any);
    
    render(<AssistantChat assistant={mockAssistant} />);
    
    expect(screen.getByText(/thinking/i)).toBeInTheDocument();
  });

  it('should handle keyboard submit', async () => {
    render(<AssistantChat assistant={mockAssistant} />);
    
    const input = screen.getByPlaceholderText(/type your message/i);
    
    fireEvent.change(input, { target: { value: 'Help me with my resume' } });
    fireEvent.keyPress(input, { key: 'Enter', code: 'Enter', charCode: 13 });
    
    await waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalledWith('Help me with my resume');
    });
  });

  it('should display error state', () => {
    vi.mocked(useAssistantChat).mockReturnValue({
      ...vi.mocked(useAssistantChat).mock.results[0].value,
      error: 'Failed to send message',
    } as any);
    
    render(<AssistantChat assistant={mockAssistant} />);
    
    expect(screen.getByText(/failed to send message/i)).toBeInTheDocument();
  });

  it('should scroll to bottom on new messages', async () => {
    const scrollIntoViewMock = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoViewMock;
    
    const { rerender } = render(<AssistantChat assistant={mockAssistant} />);
    
    // Add a new message
    vi.mocked(useAssistantChat).mockReturnValue({
      ...vi.mocked(useAssistantChat).mock.results[0].value,
      messages: [
        ...mockMessages,
        {
          id: '3',
          role: 'assistant',
          content: 'Here are some career suggestions...',
          timestamp: new Date().toISOString(),
        },
      ],
    } as any);
    
    rerender(<AssistantChat assistant={mockAssistant} />);
    
    await waitFor(() => {
      expect(scrollIntoViewMock).toHaveBeenCalled();
    });
  });
});