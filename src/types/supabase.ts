
export interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  role: string;
}

export interface Conversation {
  id: string;
  subject: string | null;
  is_group: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  participants?: ConversationParticipant[];
  last_message?: Message;
}

export interface ConversationParticipant {
  id: string;
  conversation_id: string;
  user_id: string;
  added_at: string;
  profile?: Profile;
}

export interface Message {
  id: string;
  sender_id: string;
  conversation_id: string;
  content: string;
  attachment_url: string | null;
  read: boolean;
  created_at: string;
  sender?: Profile;
}
