
import { v4 as uuidv4 } from 'uuid';
import { sub } from 'date-fns';

// Create realistic mock data for conversations
export const mockConversations = [
  {
    id: uuidv4(),
    subject: "Project Collaboration",
    is_group: false,
    created_by: "user1",
    updated_at: sub(new Date(), { hours: 2 }).toISOString(),
    created_at: sub(new Date(), { days: 3 }).toISOString(),
    participants: [
      {
        id: uuidv4(),
        user_id: "user1",
        conversation_id: "conv1",
        added_at: sub(new Date(), { days: 3 }).toISOString(),
        profile: {
          id: "user1",
          first_name: "John",
          last_name: "Doe",
          avatar_url: "https://api.dicebear.com/6.x/avataaars/svg?seed=John",
          role: "student"
        }
      },
      {
        id: uuidv4(),
        user_id: "user2",
        conversation_id: "conv1",
        added_at: sub(new Date(), { days: 3 }).toISOString(),
        profile: {
          id: "user2",
          first_name: "David",
          last_name: "Rodriguez",
          avatar_url: "https://api.dicebear.com/6.x/avataaars/svg?seed=David",
          role: "instructor"
        }
      }
    ],
    last_message: {
      id: uuidv4(),
      sender_id: "user2",
      content: "Hi! Would you like to collaborate on a project?",
      read: false,
      created_at: sub(new Date(), { hours: 2 }).toISOString()
    }
  },
  {
    id: uuidv4(),
    subject: "Group Project",
    is_group: true,
    created_by: "user1",
    updated_at: sub(new Date(), { hours: 5 }).toISOString(),
    created_at: sub(new Date(), { days: 5 }).toISOString(),
    participants: [
      {
        id: uuidv4(),
        user_id: "user1",
        conversation_id: "conv2",
        added_at: sub(new Date(), { days: 5 }).toISOString(),
        profile: {
          id: "user1",
          first_name: "John",
          last_name: "Doe",
          avatar_url: "https://api.dicebear.com/6.x/avataaars/svg?seed=John",
          role: "student"
        }
      },
      {
        id: uuidv4(),
        user_id: "user2",
        conversation_id: "conv2",
        added_at: sub(new Date(), { days: 5 }).toISOString(),
        profile: {
          id: "user2",
          first_name: "David",
          last_name: "Rodriguez",
          avatar_url: "https://api.dicebear.com/6.x/avataaars/svg?seed=David",
          role: "instructor"
        }
      },
      {
        id: uuidv4(),
        user_id: "user3",
        conversation_id: "conv2",
        added_at: sub(new Date(), { days: 5 }).toISOString(),
        profile: {
          id: "user3",
          first_name: "Jennifer",
          last_name: "Thompson",
          avatar_url: "https://api.dicebear.com/6.x/avataaars/svg?seed=Jennifer",
          role: "student"
        }
      }
    ],
    last_message: {
      id: uuidv4(),
      sender_id: "user3",
      content: "I've uploaded the files for our group project.",
      read: true,
      created_at: sub(new Date(), { hours: 5 }).toISOString()
    }
  },
  {
    id: uuidv4(),
    subject: "Question about assignment",
    is_group: false,
    created_by: "user1",
    updated_at: sub(new Date(), { hours: 21 }).toISOString(),
    created_at: sub(new Date(), { days: 2 }).toISOString(),
    participants: [
      {
        id: uuidv4(),
        user_id: "user1",
        conversation_id: "conv3",
        added_at: sub(new Date(), { days: 2 }).toISOString(),
        profile: {
          id: "user1",
          first_name: "John",
          last_name: "Doe",
          avatar_url: "https://api.dicebear.com/6.x/avataaars/svg?seed=John",
          role: "student"
        }
      },
      {
        id: uuidv4(),
        user_id: "user3",
        conversation_id: "conv3",
        added_at: sub(new Date(), { days: 2 }).toISOString(),
        profile: {
          id: "user3",
          first_name: "Jennifer",
          last_name: "Thompson",
          avatar_url: "https://api.dicebear.com/6.x/avataaars/svg?seed=Jennifer",
          role: "student"
        }
      }
    ],
    last_message: {
      id: uuidv4(),
      sender_id: "user1",
      content: "Start a conversation",
      read: true,
      created_at: sub(new Date(), { hours: 21 }).toISOString()
    }
  },
  {
    id: uuidv4(),
    subject: "Welcome message",
    is_group: false,
    created_by: "user1",
    updated_at: sub(new Date(), { days: 2 }).toISOString(),
    created_at: sub(new Date(), { days: 2 }).toISOString(),
    participants: [
      {
        id: uuidv4(),
        user_id: "user1",
        conversation_id: "conv4",
        added_at: sub(new Date(), { days: 2 }).toISOString(),
        profile: {
          id: "user1",
          first_name: "John",
          last_name: "Doe",
          avatar_url: "https://api.dicebear.com/6.x/avataaars/svg?seed=John",
          role: "student"
        }
      },
      {
        id: uuidv4(),
        user_id: "admin",
        conversation_id: "conv4",
        added_at: sub(new Date(), { days: 2 }).toISOString(),
        profile: {
          id: "admin",
          first_name: "Admin",
          last_name: "",
          avatar_url: null,
          role: "admin"
        }
      }
    ],
    last_message: {
      id: uuidv4(),
      sender_id: "admin",
      content: "Welcome to the platform! How can I help you get started?",
      read: true,
      created_at: sub(new Date(), { days: 2 }).toISOString()
    }
  }
];

export const getMockConversations = () => {
  // Return a deep copy to simulate fetching from a server
  return JSON.parse(JSON.stringify(mockConversations));
};

export const getMockMessages = (conversationId: string) => {
  // In a real app, we would fetch based on conversationId
  return [
    {
      id: uuidv4(),
      sender_id: "user2",
      conversation_id: conversationId,
      content: "Hi! Would you like to collaborate on a project?",
      read: true,
      created_at: sub(new Date(), { hours: 3 }).toISOString(),
      sender: {
        id: "user2",
        first_name: "David",
        last_name: "Rodriguez",
        avatar_url: "https://api.dicebear.com/6.x/avataaars/svg?seed=David",
        role: "instructor",
        roles: ["instructor", "student"]
      }
    },
    {
      id: uuidv4(),
      sender_id: "user1",
      conversation_id: conversationId,
      content: "That sounds great! What kind of project do you have in mind?",
      read: true,
      created_at: sub(new Date(), { hours: 2.5 }).toISOString(),
      sender: {
        id: "user1",
        first_name: "John",
        last_name: "Doe",
        avatar_url: "https://api.dicebear.com/6.x/avataaars/svg?seed=John",
        role: "student",
        roles: ["student"]
      }
    },
    {
      id: uuidv4(),
      sender_id: "user2",
      conversation_id: conversationId,
      content: "I was thinking we could build a data visualization dashboard for the course project.",
      read: true,
      created_at: sub(new Date(), { hours: 2 }).toISOString(),
      sender: {
        id: "user2",
        first_name: "David",
        last_name: "Rodriguez",
        avatar_url: "https://api.dicebear.com/6.x/avataaars/svg?seed=David",
        role: "instructor",
        roles: ["instructor", "student"]
      }
    }
  ];
};
